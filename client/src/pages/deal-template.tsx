import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useSearch } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Save, Eye } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// Deal page template form schema
const dealPageSchema = z.object({
  title: z.string().min(1, "Title is required").max(300, "Title too long"),
  slug: z.string().min(1, "URL slug is required").max(200, "Slug too long")
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  restaurant: z.string().min(1, "Restaurant name is required").max(100, "Restaurant name too long"),
  offerDescription: z.string().min(1, "Offer description is required"),
  triggerCondition: z.string().min(1, "Trigger condition is required").max(200, "Trigger condition too long"),
  dealValue: z.string().optional(),
  promoCode: z.string().optional(),
  instructions: z.string().optional(),
  terms: z.string().optional(),
  validFrom: z.date().optional(),
  validUntil: z.date().optional(),
  sourceUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  imageUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type DealPageFormData = z.infer<typeof dealPageSchema>;

interface DealTemplateProps {
  discoveredSiteId?: number;
  initialData?: Partial<DealPageFormData>;
  onSuccess?: (dealPage: any) => void;
}

export default function DealTemplate({ discoveredSiteId, initialData, onSuccess }: DealTemplateProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [previewMode, setPreviewMode] = useState(false);
  const search = useSearch();
  
  // Parse URL parameters
  const urlParams = new URLSearchParams(search);
  const siteIdFromUrl = urlParams.get('siteId');
  const titleFromUrl = urlParams.get('title');
  const restaurantFromUrl = urlParams.get('restaurant');

  // Fetch discovered site data if siteId provided
  const { data: siteData } = useQuery<{site: any}>({
    queryKey: [`/api/admin/discovery/sites/${siteIdFromUrl}`],
    enabled: !!siteIdFromUrl,
  });

  // Parse extracted deal data if available
  const extractedDeal = siteData?.site?.dealExtracted 
    ? JSON.parse(siteData.site.dealExtracted) 
    : null;

  const form = useForm<DealPageFormData>({
    resolver: zodResolver(dealPageSchema),
    defaultValues: {
      title: extractedDeal?.title || titleFromUrl || "",
      slug: "",
      restaurant: extractedDeal?.restaurant || restaurantFromUrl || "",
      offerDescription: extractedDeal?.offer || "",
      triggerCondition: extractedDeal?.trigger || "When the LA Dodgers win a home game",
      dealValue: extractedDeal?.value || "",
      promoCode: extractedDeal?.code || "",
      instructions: extractedDeal?.instructions || "",
      terms: extractedDeal?.terms || "",
      sourceUrl: siteData?.site?.url || "",
      imageUrl: extractedDeal?.imageUrl || "",
      ...initialData,
    },
  });
  
  // Auto-generate slug from title
  useEffect(() => {
    const title = form.watch('title');
    if (title && !form.getValues('slug')) {
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      form.setValue('slug', slug);
    }
  }, [form.watch('title')]);

  const createDealPageMutation = useMutation({
    mutationFn: async (data: DealPageFormData) => {
      const payload = {
        ...data,
        discoveredSiteId: discoveredSiteId || (siteIdFromUrl ? parseInt(siteIdFromUrl) : undefined),
        validFrom: data.validFrom?.toISOString(),
        validUntil: data.validUntil?.toISOString(),
      };
      const res = await apiRequest("POST", "/api/admin/deal-pages", payload);
      return await res.json();
    },
    onSuccess: (dealPage) => {
      toast({
        title: "Deal page created successfully",
        description: `${dealPage.title} is now live at /deal/${dealPage.slug}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/deal-pages"] });
      form.reset();
      onSuccess?.(dealPage);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create deal page",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: DealPageFormData) => {
    createDealPageMutation.mutate(data);
  };

  // Auto-generate slug from title
  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const watchedTitle = form.watch("title");
  const watchedSlug = form.watch("slug");

  // Auto-update slug when title changes (if slug is empty)
  useState(() => {
    if (watchedTitle && !watchedSlug) {
      form.setValue("slug", generateSlug(watchedTitle));
    }
  });

  if (previewMode) {
    const formData = form.getValues();
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Deal Preview</h1>
          <Button onClick={() => setPreviewMode(false)}>
            <Eye className="w-4 h-4 mr-2" />
            Edit
          </Button>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{formData.title}</CardTitle>
            <p className="text-muted-foreground">URL: /deal/{formData.slug}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold">Restaurant:</h3>
              <p>{formData.restaurant}</p>
            </div>
            <div>
              <h3 className="font-semibold">Offer:</h3>
              <p>{formData.offerDescription}</p>
            </div>
            <div>
              <h3 className="font-semibold">Trigger Condition:</h3>
              <p>{formData.triggerCondition}</p>
            </div>
            {formData.dealValue && (
              <div>
                <h3 className="font-semibold">Deal Value:</h3>
                <p>{formData.dealValue}</p>
              </div>
            )}
            {formData.promoCode && (
              <div>
                <h3 className="font-semibold">Promo Code:</h3>
                <p className="font-mono bg-muted px-2 py-1 rounded">{formData.promoCode}</p>
              </div>
            )}
            {formData.instructions && (
              <div>
                <h3 className="font-semibold">How to Claim:</h3>
                <p>{formData.instructions}</p>
              </div>
            )}
            {formData.terms && (
              <div>
                <h3 className="font-semibold">Terms & Conditions:</h3>
                <p className="text-sm text-muted-foreground">{formData.terms}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Create Deal Page</h1>
        <Button variant="outline" onClick={() => setPreviewMode(true)}>
          <Eye className="w-4 h-4 mr-2" />
          Preview
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deal Title</FormLabel>
                    <FormControl>
                      <Input placeholder="McDonald's Free Nuggets when Dodgers score 6+ runs" {...field} />
                    </FormControl>
                    <FormDescription>This will be the headline for your deal page</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL Slug</FormLabel>
                    <FormControl>
                      <Input placeholder="mcdonalds-nuggets-dodgers-runs" {...field} />
                    </FormControl>
                    <FormDescription>URL-friendly identifier (lowercase, hyphens only). Will be: /deal/{field.value}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="restaurant"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Restaurant</FormLabel>
                    <FormControl>
                      <Input placeholder="McDonald's" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deal Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="offerDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Offer Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Get free 6-piece chicken nuggets with purchase of medium or large fries when the Dodgers score 6 or more runs in any game"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>Detailed description of what the user gets</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="triggerCondition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trigger Condition</FormLabel>
                    <FormControl>
                      <Input placeholder="Dodgers score 6+ runs in any game" {...field} />
                    </FormControl>
                    <FormDescription>When does this deal become available?</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dealValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deal Value</FormLabel>
                      <FormControl>
                        <Input placeholder="Free" {...field} />
                      </FormControl>
                      <FormDescription>Free, $5 off, BOGO, etc.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="promoCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Promo Code</FormLabel>
                      <FormControl>
                        <Input placeholder="DODGERS6" {...field} />
                      </FormControl>
                      <FormDescription>If applicable</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Instructions & Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>How to Claim</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="1. Open the McDonald's app&#10;2. Add medium or large fries to cart&#10;3. Nuggets will be automatically added for free&#10;4. Valid day after game through 11:59 PM"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>Step-by-step instructions for users</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="terms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Terms & Conditions</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Valid at participating locations only. Cannot be combined with other offers. One per customer per day."
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>Fine print and limitations</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Validity & Sources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="validFrom"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Valid From</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date < new Date(new Date().setHours(0, 0, 0, 0))
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="validUntil"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Valid Until</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date < new Date(new Date().setHours(0, 0, 0, 0))
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="sourceUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://www.mcdonalds.com/promotions/dodgers" {...field} />
                    </FormControl>
                    <FormDescription>Link to the official promotion page</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com/promo-image.jpg" {...field} />
                    </FormControl>
                    <FormDescription>Promotional image or logo</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={createDealPageMutation.isPending}
              className="min-w-[120px]"
            >
              {createDealPageMutation.isPending ? (
                "Creating..."
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Create Deal Page
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
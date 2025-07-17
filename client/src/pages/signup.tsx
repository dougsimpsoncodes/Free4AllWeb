import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";

const signupSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phoneNumber: z.string().optional(),
  favoriteTeams: z.array(z.number()).min(1, "Please select at least one team"),
  emailNotifications: z.boolean().default(true),
  smsNotifications: z.boolean().default(false),
  city: z.string().min(1, "City is required"),
  zipCode: z.string().min(5, "Valid zip code is required"),
});

type SignupFormData = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [step, setStep] = useState(1);

  // Set document title
  useEffect(() => {
    document.title = "Sign Up - Free4All";
    return () => {
      document.title = "Free4All";
    };
  }, []);

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      phoneNumber: "",
      favoriteTeams: [],
      emailNotifications: true,
      smsNotifications: false,
      city: "",
      zipCode: "",
    },
  });

  // Fetch available teams
  const { data: teams = [] } = useQuery({
    queryKey: ["/api/teams"],
  });

  // Create alert preferences mutation
  const createPreferencesMutation = useMutation({
    mutationFn: async (data: SignupFormData) => {
      // Create alert preferences for each selected team
      const preferences = data.favoriteTeams.map(teamId => ({
        teamId,
        emailEnabled: data.emailNotifications,
        smsEnabled: data.smsNotifications,
        phoneNumber: data.phoneNumber || null,
      }));

      for (const preference of preferences) {
        await apiRequest("/api/alert-preferences", {
          method: "POST",
          body: preference,
        });
      }

      // Update user profile with additional info
      await apiRequest("/api/user/profile", {
        method: "PATCH",
        body: {
          city: data.city,
          zipCode: data.zipCode,
          phoneNumber: data.phoneNumber,
        },
      });

      return preferences;
    },
    onSuccess: () => {
      toast({
        title: "Welcome to Free4All!",
        description: "Your deal alerts are now set up. You'll get notified when your teams trigger deals!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/alert-preferences"] });
      setLocation("/");
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Authentication Required",
          description: "Please log in to complete your sign-up.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/auth/google";
        }, 500);
        return;
      }
      toast({
        title: "Sign-up Failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SignupFormData) => {
    createPreferencesMutation.mutate(data);
  };

  // Redirect to login if not authenticated
  if (!isLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-400 to-blue-500 flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Authentication Required</CardTitle>
            <CardDescription>
              Please log in to complete your Free4All sign-up
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => window.location.href = "/api/auth/google"}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Sign In with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-400 to-blue-500 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-400 to-blue-500">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-400 to-blue-500 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-12">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                <span className="text-xl">🍕</span>
              </div>
              <span className="text-2xl font-bold text-white">Free4All</span>
            </div>
          </div>
        </div>
      </header>

      {/* Sign-up Form */}
      <div className="py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-gray-900">
                Set Up Your Deal Alerts
              </CardTitle>
              <CardDescription className="text-lg">
                Tell us about your favorite teams and we'll notify you when they trigger food deals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {step === 1 && (
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold text-gray-900 mb-4">Personal Information</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>First Name</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last Name</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>City</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Los Angeles" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="zipCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Zip Code</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="90210" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="phoneNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number (Optional)</FormLabel>
                            <FormControl>
                              <Input {...field} type="tel" placeholder="(555) 123-4567" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end">
                        <Button 
                          type="button" 
                          onClick={() => setStep(2)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          Next: Choose Teams
                        </Button>
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold text-gray-900 mb-4">Favorite Teams</h3>
                      
                      <FormField
                        control={form.control}
                        name="favoriteTeams"
                        render={() => (
                          <FormItem>
                            <FormLabel>Select your favorite teams (choose at least one)</FormLabel>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                              {teams.map((team: any) => (
                                <FormField
                                  key={team.id}
                                  control={form.control}
                                  name="favoriteTeams"
                                  render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(team.id)}
                                          onCheckedChange={(checked) => {
                                            const updatedValue = checked
                                              ? [...(field.value || []), team.id]
                                              : (field.value || []).filter(id => id !== team.id);
                                            field.onChange(updatedValue);
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="text-sm font-normal">
                                        {team.name} ({team.sport})
                                      </FormLabel>
                                    </FormItem>
                                  )}
                                />
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-between">
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={() => setStep(1)}
                        >
                          Back
                        </Button>
                        <Button 
                          type="button" 
                          onClick={() => setStep(3)}
                          className="bg-blue-600 hover:bg-blue-700"
                          disabled={form.watch("favoriteTeams")?.length === 0}
                        >
                          Next: Notifications
                        </Button>
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold text-gray-900 mb-4">Notification Preferences</h3>
                      
                      <FormField
                        control={form.control}
                        name="emailNotifications"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Email Notifications</FormLabel>
                              <p className="text-sm text-gray-600">
                                Get email alerts when your teams trigger deals
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="smsNotifications"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>SMS Notifications</FormLabel>
                              <p className="text-sm text-gray-600">
                                Get text message alerts (requires phone number)
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />

                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="font-semibold text-green-800 mb-2">You're all set!</h4>
                        <p className="text-green-700 text-sm">
                          We'll monitor your selected teams and send you alerts when they trigger deals at partner restaurants.
                        </p>
                      </div>

                      <div className="flex justify-between">
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={() => setStep(2)}
                        >
                          Back
                        </Button>
                        <Button 
                          type="submit"
                          className="bg-green-600 hover:bg-green-700"
                          disabled={createPreferencesMutation.isPending}
                        >
                          {createPreferencesMutation.isPending ? "Setting up..." : "Complete Sign-up"}
                        </Button>
                      </div>
                    </div>
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, ArrowLeft, Clock, Tag, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface DealPageData {
  id: number;
  slug: string;
  title: string;
  restaurant: string;
  offerDescription: string;
  triggerCondition: string;
  dealValue?: string;
  promoCode?: string;
  instructions?: string;
  terms?: string;
  validFrom?: string;
  validUntil?: string;
  isActive: boolean;
  sourceUrl?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export default function DealPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: dealPage, isLoading, error } = useQuery<DealPageData>({
    queryKey: ["/api/deal-pages", slug],
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-32 bg-muted rounded"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !dealPage) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <AlertCircle className="w-16 h-16 mx-auto text-muted-foreground" />
              <h1 className="text-2xl font-bold">Deal Not Found</h1>
              <p className="text-muted-foreground">
                Sorry, we couldn't find the deal you're looking for.
              </p>
              <Link href="/">
                <Button>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired = dealPage.validUntil && new Date(dealPage.validUntil) < new Date();
  const isActive = dealPage.isActive && !isExpired;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <Link href="/">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to All Deals
          </Button>
        </Link>

        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">{dealPage.title}</h1>
            <div className="flex items-center gap-2">
              <Badge variant={isActive ? "default" : "secondary"}>
                {isActive ? "Active" : isExpired ? "Expired" : "Inactive"}
              </Badge>
              {dealPage.dealValue && (
                <Badge variant="outline">{dealPage.dealValue}</Badge>
              )}
            </div>
          </div>
          
          {dealPage.imageUrl && (
            <img 
              src={dealPage.imageUrl} 
              alt={dealPage.title}
              className="w-24 h-24 object-contain rounded-lg border"
            />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Offer Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="w-5 h-5" />
                Deal Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Restaurant</h3>
                <p className="text-lg">{dealPage.restaurant}</p>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="font-semibold mb-2">Offer</h3>
                <p className="text-lg">{dealPage.offerDescription}</p>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="font-semibold mb-2">Trigger Condition</h3>
                <p className="text-lg font-medium text-primary">{dealPage.triggerCondition}</p>
              </div>

              {dealPage.promoCode && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-2">Promo Code</h3>
                    <div className="flex items-center gap-2">
                      <code className="bg-muted px-3 py-2 rounded-md font-mono text-lg font-bold">
                        {dealPage.promoCode}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(dealPage.promoCode!)}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Instructions */}
          {dealPage.instructions && (
            <Card>
              <CardHeader>
                <CardTitle>How to Claim This Deal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-line text-sm">
                  {dealPage.instructions}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Terms & Conditions */}
          {dealPage.terms && (
            <Card>
              <CardHeader>
                <CardTitle>Terms & Conditions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground whitespace-pre-line">
                  {dealPage.terms}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Validity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Validity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {dealPage.validFrom && (
                <div>
                  <p className="text-sm font-medium">Valid From</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(dealPage.validFrom), "PPP")}
                  </p>
                </div>
              )}
              
              {dealPage.validUntil && (
                <div>
                  <p className="text-sm font-medium">Valid Until</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(dealPage.validUntil), "PPP")}
                  </p>
                </div>
              )}
              
              {!dealPage.validFrom && !dealPage.validUntil && (
                <p className="text-sm text-muted-foreground">
                  No specific validity period set
                </p>
              )}
            </CardContent>
          </Card>

          {/* Source Link */}
          {dealPage.sourceUrl && (
            <Card>
              <CardHeader>
                <CardTitle>Official Source</CardTitle>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <a 
                    href={dealPage.sourceUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View on {dealPage.restaurant} Website
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Share */}
          <Card>
            <CardHeader>
              <CardTitle>Share This Deal</CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                }}
              >
                Copy Link
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
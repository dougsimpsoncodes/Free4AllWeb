import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  Database, 
  Download, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  FileDown,
  Shield,
  Eye
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface MigrationReport {
  totalDeals: number;
  testDeals: number;
  discoveredDeals: number;
  manualDeals: number;
  pendingApproval: number;
}

interface Deal {
  id: number;
  title: string;
  description: string;
  source: string;
  approvalStatus: string;
  createdAt: string;
  discoveryData?: any;
}

export default function DealMigration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTestDeals, setSelectedTestDeals] = useState<Set<number>>(new Set());
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Migration report
  const { data: report, isLoading: reportLoading } = useQuery<MigrationReport>({
    queryKey: ['/api/admin/migration/report'],
    retry: false,
  });

  // Test deals
  const { data: testDeals, isLoading: testDealsLoading } = useQuery<Deal[]>({
    queryKey: ['/api/admin/migration/test-deals'],
    retry: false,
  });

  // Discovered deals
  const { data: discoveredDeals, isLoading: discoveredDealsLoading } = useQuery<Deal[]>({
    queryKey: ['/api/admin/migration/discovered-deals'],
    retry: false,
  });

  // Mark existing deals as test
  const markTestDealsMutation = useMutation({
    mutationFn: () => apiRequest('/api/admin/migration/mark-test-deals', 'POST'),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Existing deals marked as test data",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/migration/report'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/migration/test-deals'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark test deals",
        variant: "destructive",
      });
    },
  });

  // Backup test deals
  const backupTestDealsMutation = useMutation({
    mutationFn: () => apiRequest('/api/admin/migration/backup-test-deals', 'POST'),
    onSuccess: (data) => {
      // Create download link
      const blob = new Blob([data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test-deals-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Success",
        description: "Test deals backup downloaded",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create backup",
        variant: "destructive",
      });
    },
  });

  // Remove test deals
  const removeTestDealsMutation = useMutation({
    mutationFn: (dealIds: number[]) => 
      apiRequest('/api/admin/migration/test-deals', 'DELETE', { dealIds }),
    onSuccess: (data: any) => {
      toast({
        title: "Success",
        description: `Removed ${data.deletedCount} test deals`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/migration/report'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/migration/test-deals'] });
      setSelectedTestDeals(new Set());
      setShowConfirmDelete(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove test deals",
        variant: "destructive",
      });
    },
  });

  const toggleTestDealSelection = (dealId: number) => {
    const newSelection = new Set(selectedTestDeals);
    if (newSelection.has(dealId)) {
      newSelection.delete(dealId);
    } else {
      newSelection.add(dealId);
    }
    setSelectedTestDeals(newSelection);
  };

  const selectAllTestDeals = () => {
    if (testDeals) {
      setSelectedTestDeals(new Set(testDeals.map(deal => deal.id)));
    }
  };

  const clearSelection = () => {
    setSelectedTestDeals(new Set());
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Deal Migration</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage transition from test deals to production discovery system
            </p>
          </div>
        </div>

        {/* Migration Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Migration Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reportLoading ? (
              <div className="text-center py-4">Loading report...</div>
            ) : report ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{report.totalDeals}</div>
                  <div className="text-sm text-gray-600">Total Deals</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{report.testDeals}</div>
                  <div className="text-sm text-gray-600">Test Deals</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{report.discoveredDeals}</div>
                  <div className="text-sm text-gray-600">Discovered</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{report.manualDeals}</div>
                  <div className="text-sm text-gray-600">Manual</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{report.pendingApproval}</div>
                  <div className="text-sm text-gray-600">Pending</div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">Failed to load report</div>
            )}
          </CardContent>
        </Card>

        {/* Migration Strategy */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Migration Strategy:</strong> Test deals are manually created promotions used during development. 
            Discovered deals come from the automated discovery system and require admin approval. 
            This page helps you safely transition from test data to production-discovered deals.
          </AlertDescription>
        </Alert>

        {/* Migration Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Migration Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-medium">1. Mark Existing Deals as Test Data</h3>
                  <p className="text-sm text-gray-600">Tag all current deals as test data for easier management</p>
                </div>
                <Button
                  onClick={() => markTestDealsMutation.mutate()}
                  disabled={markTestDealsMutation.isPending}
                  variant="outline"
                >
                  Mark Test Deals
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-medium">2. Backup Test Deals</h3>
                  <p className="text-sm text-gray-600">Download backup before deletion (recommended)</p>
                </div>
                <Button
                  onClick={() => backupTestDealsMutation.mutate()}
                  disabled={backupTestDealsMutation.isPending}
                  variant="outline"
                  className="gap-2"
                >
                  <FileDown className="h-4 w-4" />
                  Create Backup
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-medium">3. Review & Remove Test Deals</h3>
                  <p className="text-sm text-gray-600">Safely remove test deals after backing up</p>
                </div>
                <Button
                  onClick={() => setShowConfirmDelete(true)}
                  disabled={selectedTestDeals.size === 0}
                  variant="destructive"
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove Selected ({selectedTestDeals.size})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Deals Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Test Deals ({testDeals?.length || 0})</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={selectAllTestDeals}>
                  Select All
                </Button>
                <Button size="sm" variant="outline" onClick={clearSelection}>
                  Clear Selection
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {testDealsLoading ? (
              <div className="text-center py-8">Loading test deals...</div>
            ) : testDeals && testDeals.length > 0 ? (
              <div className="space-y-2">
                {testDeals.map((deal) => (
                  <div key={deal.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <input
                      type="checkbox"
                      checked={selectedTestDeals.has(deal.id)}
                      onChange={() => toggleTestDealSelection(deal.id)}
                      className="h-4 w-4"
                    />
                    <div className="flex-1">
                      <h4 className="font-medium">{deal.title}</h4>
                      <p className="text-sm text-gray-600">{deal.description}</p>
                    </div>
                    <Badge variant="outline">Test Data</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No test deals found</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Discovered Deals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Discovered Deals ({discoveredDeals?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {discoveredDealsLoading ? (
              <div className="text-center py-8">Loading discovered deals...</div>
            ) : discoveredDeals && discoveredDeals.length > 0 ? (
              <div className="space-y-2">
                {discoveredDeals.map((deal) => (
                  <div key={deal.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium">{deal.title}</h4>
                      <p className="text-sm text-gray-600">{deal.description}</p>
                    </div>
                    <Badge variant={deal.approvalStatus === 'approved' ? 'default' : 'secondary'}>
                      {deal.approvalStatus}
                    </Badge>
                    <Badge variant="outline">Discovered</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No discovered deals yet</p>
                <p className="text-sm">Use the Deal Discovery system to find new promotions</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Confirmation Dialog */}
        {showConfirmDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-6 w-6 text-red-500" />
                <h3 className="text-lg font-bold">Confirm Deletion</h3>
              </div>
              <p className="mb-6">
                Are you sure you want to delete {selectedTestDeals.size} test deals? 
                This action cannot be undone. Make sure you have created a backup first.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowConfirmDelete(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => removeTestDealsMutation.mutate(Array.from(selectedTestDeals))}
                  disabled={removeTestDealsMutation.isPending}
                >
                  {removeTestDealsMutation.isPending ? 'Deleting...' : 'Delete Test Deals'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { GoogleMap, LoadScript, Marker, InfoWindow } from "@react-google-maps/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReimbursementService, Reimbursement } from "@/services/reimbursementService";
import { formatDistance, formatAmount } from "@/utils/locationUtils";
import { Search, Filter, Download } from "lucide-react";

const Reimbursements = () => {
  const { toast } = useToast();
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [selectedReimbursement, setSelectedReimbursement] = useState<Reimbursement | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: -1.2921, lng: 36.8219 }); // CUEA coordinates
  const [mapZoom, setMapZoom] = useState(12);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: "",
    search: "",
  });

  // Load reimbursements with related data
  useEffect(() => {
    const loadReimbursements = async () => {
      try {
        const data = await ReimbursementService.getReimbursements({
          status: filters.status || undefined
        });
        setReimbursements(data);
      } catch (error: any) {
        toast({
          title: "Error",
          description: "Failed to load reimbursements: " + error.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadReimbursements();
  }, [filters.status]);

  // Handle reimbursement approval
  const handleApprove = async (id: string) => {
    try {
      await ReimbursementService.updateReimbursementStatus(id, "approved");
      setReimbursements(prev => 
        prev.map(r => r.id === id ? { ...r, status: "approved" } : r)
      );
      toast({
        title: "Success",
        description: "Reimbursement approved successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to approve reimbursement: " + error.message,
        variant: "destructive",
      });
    }
  };

  // Handle reimbursement rejection
  const handleReject = async (id: string) => {
    try {
      await ReimbursementService.updateReimbursementStatus(id, "rejected");
      setReimbursements(prev => 
        prev.map(r => r.id === id ? { ...r, status: "rejected" } : r)
      );
      toast({
        title: "Success",
        description: "Reimbursement rejected successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to reject reimbursement: " + error.message,
        variant: "destructive",
      });
    }
  };

  // Get status badge color
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-500">Rejected</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500">Pending</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Filter reimbursements based on search term
  const filteredReimbursements = reimbursements.filter(r => {
    const searchTerm = filters.search.toLowerCase();
    const supervisorName = `${r.supervisor?.profile?.first_name} ${r.supervisor?.profile?.last_name}`.toLowerCase();
    const studentName = `${r.student?.profile?.first_name} ${r.student?.profile?.last_name}`.toLowerCase();
    const companyName = r.company?.name?.toLowerCase() || '';
    const companyLocation = r.company?.location?.toLowerCase() || '';

    return (
      supervisorName.includes(searchTerm) ||
      studentName.includes(searchTerm) ||
      companyName.includes(searchTerm) ||
      companyLocation.includes(searchTerm)
    );
  });

  // Export reimbursements to CSV
  const exportToCSV = () => {
    const headers = [
      "Supervisor",
      "Student",
      "Company",
      "Location",
      "Distance",
      "Amount",
      "Status",
      "Date"
    ];

    const rows = filteredReimbursements.map(r => [
      `${r.supervisor?.profile?.first_name} ${r.supervisor?.profile?.last_name}`,
      `${r.student?.profile?.first_name} ${r.student?.profile?.last_name}`,
      r.company?.name || '',
      r.company?.location || '',
      formatDistance(r.distance),
      formatAmount(r.amount),
      r.status,
      new Date(r.created_at).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reimbursements_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Reimbursement Management</h1>
        <Button onClick={exportToCSV}>
          <Download className="mr-2 h-4 w-4" />
          Export to CSV
        </Button>
      </div>
      
      <Tabs defaultValue="map" className="space-y-4">
        <TabsList>
          <TabsTrigger value="map">Map View</TabsTrigger>
          <TabsTrigger value="list">List View</TabsTrigger>
        </TabsList>

        <TabsContent value="map">
          <Card>
            <CardHeader>
              <CardTitle>Company Locations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[600px] w-full">
                <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
                  <GoogleMap
                    mapContainerStyle={{ width: "100%", height: "100%" }}
                    center={mapCenter}
                    zoom={mapZoom}
                  >
                    {filteredReimbursements.map((reimbursement) => (
                      <Marker
                        key={reimbursement.id}
                        position={async () => {
                          const coords = await getCoordinates(reimbursement.company.location);
                          return { lat: coords.lat, lng: coords.lng };
                        }}
                        onClick={() => setSelectedReimbursement(reimbursement)}
                      />
                    ))}
                    
                    {selectedReimbursement && (
                      <InfoWindow
                        position={async () => {
                          const coords = await getCoordinates(selectedReimbursement.company.location);
                          return { lat: coords.lat, lng: coords.lng };
                        }}
                        onCloseClick={() => setSelectedReimbursement(null)}
                      >
                        <div className="p-2">
                          <h3 className="font-bold">{selectedReimbursement.company.name}</h3>
                          <p>Supervisor: {selectedReimbursement.supervisor.profile.first_name} {selectedReimbursement.supervisor.profile.last_name}</p>
                          <p>Student: {selectedReimbursement.student.profile.first_name} {selectedReimbursement.student.profile.last_name}</p>
                          <p>Distance: {formatDistance(selectedReimbursement.distance)}</p>
                          <p>Amount: {formatAmount(selectedReimbursement.amount)}</p>
                          <p>Status: {selectedReimbursement.status}</p>
                        </div>
                      </InfoWindow>
                    )}
                  </GoogleMap>
                </LoadScript>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Reimbursement List</CardTitle>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      className="pl-8"
                      value={filters.search}
                      onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    />
                  </div>
                  <Select
                    value={filters.status}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supervisor</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Distance</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReimbursements.map((reimbursement) => (
                    <TableRow key={reimbursement.id}>
                      <TableCell>
                        {reimbursement.supervisor.profile.first_name} {reimbursement.supervisor.profile.last_name}
                        <br />
                        <span className="text-sm text-gray-500">{reimbursement.supervisor.department}</span>
                      </TableCell>
                      <TableCell>
                        {reimbursement.student.profile.first_name} {reimbursement.student.profile.last_name}
                      </TableCell>
                      <TableCell>
                        {reimbursement.company.name}
                        <br />
                        <span className="text-sm text-gray-500">{reimbursement.company.location}</span>
                      </TableCell>
                      <TableCell>{formatDistance(reimbursement.distance)}</TableCell>
                      <TableCell>{formatAmount(reimbursement.amount)}</TableCell>
                      <TableCell>{getStatusBadge(reimbursement.status)}</TableCell>
                      <TableCell>
                        {reimbursement.status === "pending" && (
                          <div className="space-x-2">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(reimbursement.id)}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject(reimbursement.id)}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reimbursements; 
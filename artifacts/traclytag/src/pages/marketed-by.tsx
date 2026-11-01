import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetCurrentUser, useListCompanies } from "@workspace/api-client-react";
import { toast } from "sonner";
import { Plus, Building, Trash2, Edit, Search, Briefcase, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export interface MarketedByItem {
  id: number;
  companyId: number | null;
  companyName?: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  gstin?: string | null;
  pan?: string | null;
  cin?: string | null;
  fssaiLicenseNo?: string | null;
  drugLicenseNo?: string | null;
  createdAt: string;
}

export default function MarketedByPage() {
  const queryClient = useQueryClient();
  const { data: user } = useGetCurrentUser();
  const isMaster = user?.role === "master" || user?.role === "super_master";
  const { data: companies = [] } = useListCompanies({ query: { enabled: isMaster } } as any);

  const [search, setSearch] = useState("");
  const [filterCompanyId, setFilterCompanyId] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MarketedByItem | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    companyId: undefined as number | undefined,
    name: "",
    email: "",
    phone: "",
    address: "",
    gstin: "",
    pan: "",
    cin: "",
    fssaiLicenseNo: "",
    drugLicenseNo: "",
  });

  const { data: marketedByList = [], isLoading } = useQuery<MarketedByItem[]>({
    queryKey: ["/api/marketed-by"],
    queryFn: async () => {
      const res = await fetch("/api/marketed-by");
      if (!res.ok) throw new Error("Failed to fetch Marketed By list");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof formData) => {
      const res = await fetch("/api/marketed-by", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create entity");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketed-by"] });
      toast.success("Marketed By entity added successfully");
      closeDialog();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add entity");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: typeof formData }) => {
      const res = await fetch(`/api/marketed-by/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update entity");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketed-by"] });
      toast.success("Marketed By entity updated successfully");
      closeDialog();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update entity");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/marketed-by/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete entity");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketed-by"] });
      toast.success("Marketed By entity deleted successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete entity");
    },
  });

  const openCreateDialog = () => {
    setEditingItem(null);
    setFormData({
      companyId: isMaster ? (companies[0]?.id || undefined) : undefined,
      name: "",
      email: "",
      phone: "",
      address: "",
      gstin: "",
      pan: "",
      cin: "",
      fssaiLicenseNo: "",
      drugLicenseNo: "",
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: MarketedByItem) => {
    setEditingItem(item);
    setFormData({
      companyId: item.companyId || undefined,
      name: item.name,
      email: item.email || "",
      phone: item.phone || "",
      address: item.address || "",
      gstin: item.gstin || "",
      pan: item.pan || "",
      cin: item.cin || "",
      fssaiLicenseNo: item.fssaiLicenseNo || "",
      drugLicenseNo: item.drugLicenseNo || "",
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Marketed By entity name is required");
      return;
    }
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, payload: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredItems = marketedByList.filter(item => {
    const matchesSearch = !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.gstin && item.gstin.toLowerCase().includes(search.toLowerCase())) ||
      (item.companyName && item.companyName.toLowerCase().includes(search.toLowerCase()));

    const matchesCompany = filterCompanyId === "all" || String(item.companyId) === filterCompanyId;

    return matchesSearch && matchesCompany;
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="mb-4 flex items-center gap-2 text-slate-500">
        <a className="text-[11px] font-bold hover:text-[#2563EB] transition-colors uppercase tracking-wider cursor-pointer" href="#">Master Data</a>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-[11px] text-[#2563EB] uppercase tracking-wider font-bold">Marketed By</span>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-[30px] leading-[36px] font-bold text-[#0F172A] tracking-[-0.02em]">Marketed By Management</h2>
          <p className="text-[16px] text-slate-600 mt-1">Manage external marketing companies, distributors, and brand partners (e.g. Mfg: Gopal, Marketed By: TATA).</p>
        </div>
        <Button 
          onClick={openCreateDialog}
          className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white px-6 py-3 h-11 rounded-lg font-semibold hover:shadow-lg hover:shadow-safety-blue/20 transition-all transform active:scale-95 cursor-pointer"
        >
          <Plus className="h-4 w-4" /> ADD MARKETED BY
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 mb-6 flex flex-wrap items-center gap-4 shadow-sm">
        <div className="flex-1 min-w-[240px]">
          <label className="text-[10px] font-bold text-[#737686] mb-1.5 block uppercase tracking-widest">Search Entity</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#737686]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg py-2 pl-10 pr-4 text-sm text-[#0F172A] focus:border-[#2563EB] focus:ring-0 outline-none transition-all placeholder:text-slate-400"
              placeholder="Search by company name, GSTIN..."
            />
          </div>
        </div>

        {isMaster && (
          <div className="flex-1 min-w-[240px]">
            <label className="text-[10px] font-bold text-[#737686] mb-1.5 block uppercase tracking-widest">Parent Company</label>
            <Select value={filterCompanyId} onValueChange={setFilterCompanyId}>
              <SelectTrigger className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg py-2 h-10 focus:ring-0 text-sm text-[#0F172A]">
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map(c => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 border-b border-[#E2E8F0] bg-[#faf8ff] flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <span className="text-[18px] font-semibold text-[#0F172A]">Registered Marketed By Entities</span>
            <span className="bg-[#ededf9] text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">Active</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table className="w-full text-left table-fixed">
            <TableHeader>
              <TableRow className="border-b border-[#E2E8F0] bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="text-slate-500 tracking-wider w-[25%] text-[11px] font-bold px-6 py-4 uppercase">ENTITY NAME</TableHead>
                {isMaster && (
                  <TableHead className="text-slate-500 tracking-wider w-[20%] text-[11px] font-bold px-6 py-4 uppercase">MANUFACTURER / COMPANY</TableHead>
                )}
                <TableHead className="text-slate-500 tracking-wider w-[15%] text-[11px] font-bold px-6 py-4 uppercase">GSTIN</TableHead>
                <TableHead className="text-slate-500 tracking-wider w-[20%] text-[11px] font-bold px-6 py-4 uppercase">CONTACT / EMAIL</TableHead>
                <TableHead className="text-slate-500 tracking-wider w-[10%] text-[11px] font-bold px-6 py-4 uppercase">ADDRESS</TableHead>
                <TableHead className="text-slate-500 tracking-wider w-[10%] text-[11px] font-bold px-6 py-4 uppercase text-right">ACTIONS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-[#E2E8F0]">
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={isMaster ? 6 : 5} className="text-center py-10 text-slate-400">Loading entities...</TableCell>
                </TableRow>
              ) : filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isMaster ? 6 : 5} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Briefcase className="h-8 w-8 text-slate-300" />
                      <p className="text-[14px] font-semibold text-slate-500">No Marketed By entities registered yet</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map(item => (
                  <TableRow key={item.id} className="hover:bg-slate-50 transition-colors group border-0">
                    <TableCell className="align-middle px-6 py-5">
                      <span className="font-bold text-[#0F172A] text-[14px] block">{item.name}</span>
                      {item.pan && <span className="text-[11px] font-mono text-slate-500">PAN: {item.pan}</span>}
                    </TableCell>
                    {isMaster && (
                      <TableCell className="align-middle px-6 py-5">
                        <span className="text-[13px] font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block">
                          {item.companyName || "Global"}
                        </span>
                      </TableCell>
                    )}
                    <TableCell className="align-middle px-6 py-5">
                      <span className="font-mono text-[13px] font-semibold text-slate-700">
                        {item.gstin || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="align-middle px-6 py-5">
                      <span className="text-[13px] text-slate-800 font-medium block">{item.email || "-"}</span>
                      {item.phone && <span className="text-[11px] text-slate-500">{item.phone}</span>}
                    </TableCell>
                    <TableCell className="align-middle px-6 py-5">
                      <span className="text-[12px] text-slate-600 line-clamp-2 max-w-[150px]">{item.address || "-"}</span>
                    </TableCell>
                    <TableCell className="align-middle px-6 py-5 text-right flex items-center justify-end gap-1">
                      <button 
                        onClick={() => openEditDialog(item)}
                        className="p-2 text-slate-500 hover:text-[#2563EB] hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                        title="Edit entity"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer" title="Delete">
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-white border border-[#E2E8F0]">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-lg font-bold text-[#0F172A]">Delete Entity</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm text-[#434655]">
                              Permanently remove {item.name}? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => deleteMutation.mutate(item.id)}
                              className="bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl bg-white border border-[#E2E8F0]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#0F172A]">
              {editingItem ? "Edit Marketed By Entity" : "Add Marketed By Entity"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {isMaster && (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">Parent Company</Label>
                <Select 
                  value={formData.companyId ? formData.companyId.toString() : ""}
                  onValueChange={(val) => setFormData({ ...formData, companyId: val ? Number(val) : undefined })}
                >
                  <SelectTrigger className="w-full bg-[#F8FAFC] border-[#E2E8F0] h-10 text-sm">
                    <SelectValue placeholder="Select Parent Company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">Entity / Brand Name *</Label>
                <Input 
                  placeholder="e.g. TATA Consumer Products Ltd"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-[#F8FAFC] border-[#E2E8F0]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">GSTIN</Label>
                <Input 
                  placeholder="e.g. 27AAAAA0000A1Z5"
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                  className="bg-[#F8FAFC] border-[#E2E8F0] uppercase font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">Official Email</Label>
                <Input 
                  type="email"
                  placeholder="contact@brand.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-[#F8FAFC] border-[#E2E8F0]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">Phone Number</Label>
                <Input 
                  placeholder="+91 9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="bg-[#F8FAFC] border-[#E2E8F0]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">PAN</Label>
                <Input 
                  placeholder="e.g. ABCDE1234F"
                  value={formData.pan}
                  onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                  className="bg-[#F8FAFC] border-[#E2E8F0] uppercase font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">CIN</Label>
                <Input 
                  placeholder="e.g. L01111MH2020PLC123456"
                  value={formData.cin}
                  onChange={(e) => setFormData({ ...formData, cin: e.target.value.toUpperCase() })}
                  className="bg-[#F8FAFC] border-[#E2E8F0] uppercase font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">Registered Office Address</Label>
              <Input 
                placeholder="Complete address with City, State, PIN..."
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="bg-[#F8FAFC] border-[#E2E8F0]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">FSSAI License No</Label>
                <Input 
                  placeholder="14-digit FSSAI number"
                  value={formData.fssaiLicenseNo}
                  onChange={(e) => setFormData({ ...formData, fssaiLicenseNo: e.target.value })}
                  className="bg-[#F8FAFC] border-[#E2E8F0]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">Drug License No</Label>
                <Input 
                  placeholder="Drug License registration"
                  value={formData.drugLicenseNo}
                  onChange={(e) => setFormData({ ...formData, drugLicenseNo: e.target.value })}
                  className="bg-[#F8FAFC] border-[#E2E8F0]"
                />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={closeDialog} className="cursor-pointer">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-[#2563EB] hover:bg-[#2563EB]/90 text-white cursor-pointer"
              >
                {editingItem ? "Save Changes" : "Create Entity"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
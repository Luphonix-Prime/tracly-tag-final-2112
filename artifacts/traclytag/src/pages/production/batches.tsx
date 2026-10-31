import { useState } from "react";
import { useLocation } from "wouter";
import { useListBatches, getListBatchesQueryKey, useCreateBatch, useListProducts } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, Layers, CalendarIcon, ChevronRight, Search, Filter, Download, Loader2, X } from "lucide-react";
import { exportXlsx } from "@/lib/csv";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const batchSchema = z.object({
  productId: z.coerce.number().min(1, "Product is required"),
  batchNumber: z.string().min(1, "Batch number is required"),
  mfgDate: z.date({ required_error: "Manufacturing date is required" }),
  expiryDate: z.date({ required_error: "Expiry date is required" }),
});

export default function Batches() {
  const [, setLocation] = useLocation();
  const [filterProductId, setFilterProductId] = useState<number | undefined>();
  const [search, setSearch] = useState("");
  const [mfgFrom, setMfgFrom] = useState("");
  const [mfgTo, setMfgTo] = useState("");
  const [expiryFrom, setExpiryFrom] = useState("");
  const [expiryTo, setExpiryTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const { data: products = [] } = useListProducts();
  const { data: batches = [], isLoading } = useListBatches({ productId: filterProductId });
  
  const createBatch = useCreateBatch();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const form = useForm<z.infer<typeof batchSchema>>({
    resolver: zodResolver(batchSchema),
    defaultValues: {
      productId: undefined,
      batchNumber: "",
      mfgDate: undefined as any,
      expiryDate: undefined as any,
    },
  });

  const onSubmit = (values: z.infer<typeof batchSchema>) => {
    const payload = {
      productId: values.productId,
      batchNumber: values.batchNumber,
      mfgDate: format(values.mfgDate, "yyyy-MM-dd"),
      expiryDate: format(values.expiryDate, "yyyy-MM-dd"),
    };

    createBatch.mutate({ data: payload as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBatchesQueryKey() });
        toast.success("Batch created successfully");
        setIsCreateOpen(false);
        form.reset();
      },
      onError: (error: any) => {
        toast.error(error?.data?.error || "Failed to create batch");
      }
    });
  };

  const activeFilterCount = [
    Boolean(search),
    Boolean(filterProductId),
    Boolean(mfgFrom),
    Boolean(mfgTo),
    Boolean(expiryFrom),
    Boolean(expiryTo),
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setSearch("");
    setFilterProductId(undefined);
    setMfgFrom("");
    setMfgTo("");
    setExpiryFrom("");
    setExpiryTo("");
  };

  const filteredBatches = batches.filter(b => {
    const matchesSearch = !search ||
      b.batchNumber.toLowerCase().includes(search.toLowerCase()) ||
      (b.productName && b.productName.toLowerCase().includes(search.toLowerCase()));

    const matchesProduct = !filterProductId || b.productId === filterProductId;

    let matchesMfg = true;
    if (b.mfgDate) {
      const bDate = b.mfgDate.slice(0, 10);
      if (mfgFrom && bDate < mfgFrom) matchesMfg = false;
      if (mfgTo && bDate > mfgTo) matchesMfg = false;
    } else if (mfgFrom || mfgTo) {
      matchesMfg = false;
    }

    let matchesExpiry = true;
    if (b.expiryDate) {
      const eDate = b.expiryDate.slice(0, 10);
      if (expiryFrom && eDate < expiryFrom) matchesExpiry = false;
      if (expiryTo && eDate > expiryTo) matchesExpiry = false;
    } else if (expiryFrom || expiryTo) {
      matchesExpiry = false;
    }

    return matchesSearch && matchesProduct && matchesMfg && matchesExpiry;
  });

  const handleExportXlsx = () => {
    if (!filteredBatches.length) {
      toast.error("No batch records to export");
      return;
    }
    const exportData = filteredBatches.map(b => ({
      "Batch Number": b.batchNumber,
      "Product Name": b.productName || "-", 
      "Mfg Date": b.mfgDate ? format(new Date(b.mfgDate), "yyyy-MM-dd") : "-",
      "Expiry Date": b.expiryDate ? format(new Date(b.expiryDate), "yyyy-MM-dd") : "-",
      "Status": "ACTIVATED",
      "Created At": format(new Date(b.createdAt), "yyyy-MM-dd HH:mm"),
    }));
    const dateStr = format(new Date(), "yyyy-MM-dd");
    exportXlsx(`batch-registry-${dateStr}.xlsx`, exportData);
    toast.success(`Exported ${exportData.length} batch(es) to XLSX`);
  };

  return (
    <div className="space-y-6">
      {/* Page Header (Breadcrumbs + Title) */}
      <div className="mb-4 flex items-center gap-2 text-slate-500">
        <a className="text-[11px] font-bold hover:text-[#2563EB] transition-colors uppercase tracking-wider cursor-pointer" href="#">Production</a>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-[11px] text-[#2563EB] uppercase tracking-wider font-bold">Batches</span>
      </div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-[30px] leading-[36px] font-bold text-[#0F172A] tracking-[-0.02em]">Batch Management</h2>
          <p className="text-[16px] text-slate-600 mt-1">Monitor and control production batch serialization across global factories.</p>
        </div>

        <Button 
          onClick={() => setLocation("/production/batches/new")}
          className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white px-6 py-3 h-11 rounded-lg font-semibold hover:shadow-lg hover:shadow-safety-blue/20 transition-all transform active:scale-95 cursor-pointer"
        >
          <Plus className="h-4 w-4" /> ADD BATCH
        </Button>
      </div>

      {/* Filters Section */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 mb-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[240px]">
            <label className="text-[10px] font-bold text-[#737686] mb-1.5 block uppercase tracking-widest">Search Batch No.</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#737686]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg py-2 pl-10 pr-4 text-sm text-[#0F172A] focus:border-[#2563EB] focus:ring-0 font-mono outline-none transition-all placeholder:text-slate-400"
                placeholder="e.g. BTC-2024-X91 or product name..."
              />
            </div>
          </div>
          <div className="flex-1 min-w-[240px]">
            <label className="text-[10px] font-bold text-[#737686] mb-1.5 block uppercase tracking-widest">Product Context</label>
            <Select value={filterProductId?.toString() || "all"} onValueChange={(val) => setFilterProductId(val === "all" ? undefined : parseInt(val))}>
              <SelectTrigger className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg py-2 h-10 focus:ring-0 text-sm text-[#0F172A]">
                <SelectValue placeholder="All Products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-[#737686] mb-1.5 block uppercase tracking-widest opacity-0 select-none">Filter</label>
            <Button
              type="button"
              variant={showFilters || (mfgFrom || mfgTo || expiryFrom || expiryTo) ? "default" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "p-2.5 h-10 border transition-all cursor-pointer flex items-center gap-1.5",
                showFilters || (mfgFrom || mfgTo || expiryFrom || expiryTo)
                  ? "bg-[#2563EB] text-white hover:bg-[#2563EB]/90 border-[#2563EB]"
                  : "border-[#E2E8F0] bg-white hover:bg-slate-50 text-[#434655]"
              )}
              title="Toggle date range filters"
            >
              <Filter className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white text-[#2563EB]">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>
          <div className="flex flex-col ml-auto">
            <label className="text-[10px] font-bold text-[#737686] mb-1.5 block uppercase tracking-widest opacity-0 select-none">Export</label>
            <Button
              type="button"
              onClick={handleExportXlsx}
              variant="outline"
              className="flex items-center gap-2 h-10 border border-[#E2E8F0] bg-white hover:bg-slate-50 font-bold text-[#0F172A] px-4 cursor-pointer transition-all active:scale-95 shadow-sm"
              title={`Export ${filteredBatches.length} filtered batch(es) to XLSX`}
            >
              <Download className="h-4 w-4 text-[#2563EB]" /> Export XLSX ({filteredBatches.length})
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end animate-in fade-in-50 duration-200">
            <div>
              <label className="text-[10px] font-bold text-[#737686] mb-1.5 block uppercase tracking-widest">Mfg Date From</label>
              <input
                type="date"
                value={mfgFrom}
                onChange={(e) => setMfgFrom(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg py-2 px-3 text-sm text-[#0F172A] focus:border-[#2563EB] focus:ring-0 outline-none transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#737686] mb-1.5 block uppercase tracking-widest">Mfg Date To</label>
              <input
                type="date"
                value={mfgTo}
                onChange={(e) => setMfgTo(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg py-2 px-3 text-sm text-[#0F172A] focus:border-[#2563EB] focus:ring-0 outline-none transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#737686] mb-1.5 block uppercase tracking-widest">Expiry Date From</label>
              <input
                type="date"
                value={expiryFrom}
                onChange={(e) => setExpiryFrom(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg py-2 px-3 text-sm text-[#0F172A] focus:border-[#2563EB] focus:ring-0 outline-none transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#737686] mb-1.5 block uppercase tracking-widest">Expiry Date To</label>
              <input
                type="date"
                value={expiryTo}
                onChange={(e) => setExpiryTo(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg py-2 px-3 text-sm text-[#0F172A] focus:border-[#2563EB] focus:ring-0 outline-none transition-all"
              />
            </div>
            {activeFilterCount > 0 && (
              <div className="col-span-full flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={clearAllFilters}
                  className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center gap-1.5 h-8 px-3 rounded-lg cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" /> Clear All Filters
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Data Table Container */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 border-b border-[#E2E8F0] bg-[#faf8ff] flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <span className="text-[18px] font-semibold text-[#0F172A]">Batch Registry</span>
            <span className="bg-[#ededf9] text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">Active</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table className="w-full text-left table-fixed">
            <TableHeader>
              <TableRow className="border-b border-[#E2E8F0] bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="text-slate-500 tracking-wider w-[15%] text-[11px] font-bold px-6 py-4 uppercase">BATCH NO</TableHead>
                <TableHead className="text-slate-500 tracking-wider w-[20%] text-[11px] font-bold px-6 py-4 uppercase">PRODUCT</TableHead>
                <TableHead className="text-slate-500 tracking-wider w-[15%] text-[11px] font-bold px-6 py-4 uppercase">MFG DATE</TableHead>
                <TableHead className="text-slate-500 tracking-wider w-[15%] text-[11px] font-bold px-6 py-4 uppercase">EXPIRY DATE</TableHead>
                <TableHead className="text-slate-500 tracking-wider w-[10%] text-[11px] font-bold px-6 py-4 uppercase">STATUS</TableHead>
                <TableHead className="text-slate-500 tracking-wider w-[15%] text-[11px] font-bold px-6 py-4 uppercase">CREATED</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-[#E2E8F0]">
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-[#434655]">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#2563EB] mb-2" />
                    <span>Loading production batches...</span>
                  </TableCell>
                </TableRow>
              ) : filteredBatches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Layers className="h-8 w-8 text-slate-300" />
                      <p className="text-[14px] font-semibold text-slate-500">No batches found matching criteria</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredBatches.map((batch) => (
                  <TableRow key={batch.id} className="hover:bg-slate-50 transition-colors group border-0">
                    <TableCell className="align-middle px-6 py-5">
                      <span className="font-mono font-semibold text-[#2563EB] text-[14px]">{batch.batchNumber}</span>
                    </TableCell>
                    <TableCell className="align-middle px-6 py-5">
                      <span className="text-[14px] font-bold text-[#0F172A]">{batch.productName || '-'}</span>
                    </TableCell>
                    <TableCell className="align-middle px-6 py-5">
                      <span className="text-[14px] text-slate-600 font-medium">
                        {batch.mfgDate ? format(new Date(batch.mfgDate), "MMM d, yyyy") : "-"}
                      </span>
                    </TableCell>
                    <TableCell className="align-middle px-6 py-5">
                      <span className="text-[14px] font-semibold text-red-500">
                        {batch.expiryDate ? format(new Date(batch.expiryDate), "MMM d, yyyy") : "-"}
                      </span>
                    </TableCell>
                    <TableCell className="align-middle px-6 py-5">
                      <span className="bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest inline-block">
                        Activated
                      </span>
                    </TableCell>
                    <TableCell className="align-middle px-6 py-5">
                      <span className="text-[12px] font-semibold text-slate-500 tracking-wide">
                        {format(new Date(batch.createdAt), "MMM d, yyyy HH:mm")}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      
      {/* Technical Footnote */}
      <div className="mt-8 flex items-center justify-between border-t border-[#E2E8F0] pt-6 text-[10px] text-[#737686] uppercase tracking-widest font-semibold">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#10B981] inline-block animate-pulse"></span>
            <span>System Status: Optimal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>Last Sync: 2m ago</span>
          </div>
        </div>
        <div>© 2026 TracelyTag Systems Inc. Confidential Industrial Interface</div>
      </div>
    </div>
  );
}


import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { 
  useGenerateCodes, 
  useListBatches, 
  useListProducts,
  getListCodesQueryKey,
  getGetProductReportQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { usePackagingLevelVisibility } from "@/hooks/use-packaging-level-visibility";

const generateSchema = z.object({
  productId: z.coerce.number().min(1, "Product is required"),
  batchId: z.coerce.number().min(1, "Batch is required"),
  level: z.enum(["unit", "l1", "l2", "shipper", "pallet"]),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1").max(50000, "Maximum 50,000 units"),
});

type GenerateForm = z.infer<typeof generateSchema>;

export default function GenerateCodes() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { hidePackagingLevel } = usePackagingLevelVisibility();
  
  const { data: products = [] } = useListProducts();
  const { data: batches = [] } = useListBatches({});
  const generateCodes = useGenerateCodes();

  const form = useForm<GenerateForm>({
    resolver: zodResolver(generateSchema),
    defaultValues: {
      productId: undefined,
      batchId: undefined,
      level: "unit",
      quantity: 100,
    },
  });

  const selectedProductId = form.watch("productId");

  // Keep SKU ID and Product selection in sync
  // When Product Name or SKU ID changes, update productId and filter/auto-select batch
  const handleProductChange = (val: number) => {
    form.setValue("productId", val, { shouldValidate: true });
    // Check available batches for this product
    const productBatches = batches.filter(b => b.productId === val);
    if (productBatches.length === 1) {
      // If exactly 1 batch exists, automatically select it
      form.setValue("batchId", productBatches[0].id, { shouldValidate: true });
    } else if (productBatches.length > 1) {
      // Check if current batch belongs to new product
      const currentBatchId = form.getValues("batchId");
      const stillValid = productBatches.some(b => b.id === currentBatchId);
      if (!stillValid) {
        form.setValue("batchId", undefined as any, { shouldValidate: true });
      }
    } else {
      form.setValue("batchId", undefined as any, { shouldValidate: true });
    }
  };

  // When Batch is selected directly, automatically select its parent Product Name and SKU ID
  const handleBatchChange = (batchIdVal: number) => {
    form.setValue("batchId", batchIdVal, { shouldValidate: true });
    const targetBatch = batches.find(b => b.id === batchIdVal);
    if (targetBatch && targetBatch.productId) {
      form.setValue("productId", targetBatch.productId, { shouldValidate: true });
    }
  };

  const onSubmit = (values: GenerateForm) => {
    const { productId, ...payload } = values;
    generateCodes.mutate({ data: payload as any }, {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getListCodesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetProductReportQueryKey() });
        toast.success(`Generated ${res.generated} codes successfully`);
        setLocation("/production/codes");
      },
      onError: (error: any) => {
        toast.error(error?.data?.error || "Failed to generate codes");
      }
    });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto relative z-10 font-sans">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-slate-500 font-bold text-[10px] mb-4 uppercase tracking-widest">
        <a className="hover:text-[#2563EB] transition-colors cursor-pointer" onClick={() => setLocation("/dashboard")}>Industrial Panel</a>
        <span className="material-symbols-outlined text-[12px]">chevron_right</span>
        <a className="hover:text-[#2563EB] transition-colors cursor-pointer" onClick={() => setLocation("/production/codes")}>Generate Product Codes</a>
        <span className="material-symbols-outlined text-[12px]">chevron_right</span>
        <span className="text-[#2563EB]">New Serialization Batch</span>
      </nav>

      {/* Header Section */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-[#0F172A] tracking-tight">Generate Product Codes</h1>
        <p className="text-sm text-[#434655] mt-1">Initialize secure, GS1-compliant serialization batches</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-12 gap-8">
          {/* Main Central Form Card */}
          <div className="col-span-12 lg:col-span-8">
            <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
              <div className="bg-[#F8FAFC] px-8 py-4 border-b border-[#E2E8F0]">
                <h2 className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                  Serialization Request Details
                </h2>
              </div>
              <div className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  
                  {/* Product Name */}
                  <FormField
                    control={form.control}
                    name="productId"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[11px] font-bold text-[#434655] uppercase flex items-center gap-1">
                          Product Name <span className="text-[#EF4444]">*</span>
                        </FormLabel>
                        <Select 
                          onValueChange={(val) => handleProductChange(Number(val))} 
                          value={field.value?.toString() || ""}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full bg-white border border-[#E2E8F0] h-11 rounded-lg focus:ring-0 text-sm text-[#0F172A] focus:border-[#2563EB]">
                              <SelectValue placeholder="Select Product" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {products.map(p => (
                              <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* SKU ID */}
                  <FormField
                    control={form.control}
                    name="productId"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[11px] font-bold text-[#434655] uppercase flex items-center gap-1">
                          SKU ID <span className="text-[#EF4444]">*</span>
                        </FormLabel>
                        <Select 
                          onValueChange={(val) => handleProductChange(Number(val))} 
                          value={field.value?.toString() || ""}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full bg-white border border-[#E2E8F0] h-11 rounded-lg focus:ring-0 text-sm text-[#0F172A] focus:border-[#2563EB]">
                              <SelectValue placeholder="Select SKU" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(selectedProductId
                              ? products.filter(p => p.id === Number(selectedProductId))
                              : products
                            ).map(p => (
                              <SelectItem key={p.id} value={p.id.toString()}>{p.skuId} ({p.skuSize || "No Size"})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Batch No */}
                  <FormField
                    control={form.control}
                    name="batchId"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[11px] font-bold text-[#434655] uppercase flex items-center gap-1">
                          Batch No <span className="text-[#EF4444]">*</span>
                        </FormLabel>
                        <Select 
                          onValueChange={(val) => handleBatchChange(Number(val))}
                          value={field.value?.toString() || ""}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full bg-white border border-[#E2E8F0] h-11 rounded-lg focus:ring-0 text-sm text-[#0F172A] disabled:opacity-50 focus:border-[#2563EB]">
                              <SelectValue placeholder="Select Active Batch" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(selectedProductId
                              ? batches.filter(b => b.productId === Number(selectedProductId))
                              : batches
                            ).map(b => {
                              const prod = products.find(p => p.id === b.productId);
                              const label = !selectedProductId && prod
                                ? `${b.batchNumber} (${prod.name})`
                                : b.batchNumber;
                              return (
                                <SelectItem key={b.id} value={b.id.toString()}>
                                  {label}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Quantity of Code */}
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[11px] font-bold text-[#434655] uppercase flex items-center gap-1">
                          Quantity of Code <span className="text-[#EF4444]">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            className="w-full bg-white border border-[#E2E8F0] h-11 rounded-lg focus:border-[#2563EB] focus:ring-0 text-sm font-mono" 
                            placeholder="Enter quantity (e.g., 5000)" 
                            {...field} 
                          />
                        </FormControl>
                        <p className="text-[10px] text-[#737686] italic">Maximum 50,000 units per serialization request.</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Packaging Level */}
                  {!hidePackagingLevel && (
                    <FormField
                      control={form.control}
                      name="level"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-[11px] font-bold text-[#434655] uppercase flex items-center gap-1">
                            Packaging Level <span className="text-[#EF4444]">*</span>
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="w-full bg-white border border-[#E2E8F0] h-11 rounded-lg focus:ring-0 text-sm text-[#0F172A] focus:border-[#2563EB]">
                                <SelectValue placeholder="Select Level" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="unit">Unit</SelectItem>
                              <SelectItem value="l1">Level 1 (L1)</SelectItem>
                              <SelectItem value="l2">Level 2 (L2)</SelectItem>
                              <SelectItem value="shipper">Shipper</SelectItem>
                              <SelectItem value="pallet">Pallet</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                </div>

                <div className="pt-8 border-t border-[#E2E8F0] flex flex-col md:flex-row items-center gap-4">
                  <Button
                    type="submit"
                    disabled={generateCodes.isPending}
                    className="w-full md:w-auto px-10 py-3 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2 h-11 cursor-pointer"
                  >
                    {generateCodes.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <span className="material-symbols-outlined text-xl">rocket_launch</span>
                    )}
                    Generate Codes
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Guidance/Info Sidebar */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* Security Card */}
            <div className="bg-[#0F172A] text-white rounded-xl p-6 shadow-md relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 opacity-10 rotate-12 transition-transform group-hover:rotate-0">
                <span className="material-symbols-outlined text-[80px]">verified_user</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#10B981]">shield</span>
                GS1 Standards
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Codes are generated using the AIDC-256 algorithm, ensuring 100% uniqueness across the global TracelyTag network. All serials include a 14-digit GTIN and an encrypted timestamp.
              </p>
            </div>

            {/* Facility Visualization */}
            <div className="rounded-xl overflow-hidden border border-[#E2E8F0] relative h-48">
              <img 
                className="w-full h-full object-cover grayscale-[0.2] hover:grayscale-0 transition-all duration-500"
                alt="A clean industrial laboratory setting with automated machinery printing high-precision GS1 data matrix codes onto sleek pharmaceutical packaging."
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCceayS2ntHZo8LQjTWfdIwhGYqgEl-PB2dDiMVxXXqPFuy7JJtESqM4Ug05tiP3pG0hj4b28hqLK6FV4z_IsU5Ainhc3eMlW64F3uCFs-QRfKdzGJa51kGlvvaH3wzLwGqK25gP0na5SPMQs5Gr1Qg_ocxcS2CvvcCWxvnMsvCPV7AlQGqkklBkpSAlJ5rQSRYY1zlCk63sdtu1m3_oBuK_PgZdbdOgMoqX7gS6_UOQ97ANKLxWJoA5D7BVhCfSwZ83_hIrK3kGoDY"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-4">
                <p className="text-white text-[10px] uppercase font-bold tracking-widest">Global Operations: Frankfurt Facility</p>
              </div>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}

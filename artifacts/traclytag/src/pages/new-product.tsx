import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import {
  useGetCurrentUser,
  useGetMyCompany,
  useCreateProduct,
  useListCompanies,
  getListProductsQueryKey,
  useListProducts,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { 
  Package, 
  FileText, 
  Layers, 
  CloudUpload, 
  Flame, 
  Skull, 
  Leaf, 
  Snowflake,
  Ban,
  Loader2,
  Trash2,
  Plus
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

const productSchema = z.object({
  skuId: z.string().min(1, "SKU ID required"),
  name: z.string().min(1, "Product name must be entered"),
  skuSize: z.string().optional().or(z.literal("")),
  marketedBy: z.string().min(1, "Marketed by required"),
  sapDescription: z.string().optional().or(z.literal("")),
  mrp: z.coerce.number().positive("MRP must be positive"),
  registrationNo: z.string().optional().or(z.literal("")),
  hsnCode: z.string().optional().or(z.literal("")),
  gstRate: z.coerce.number().min(0).max(100).optional().or(z.null()),
  unit: z.string().optional().or(z.literal("")),
  weightValue: z.coerce.number().min(0).optional().or(z.null()),
  weightUnit: z.string().optional().or(z.literal("")),
  packagingType: z.string().optional().or(z.literal("")),
  shelfLifeDays: z.coerce.number().int().min(0).optional().or(z.null()),
  countryOfOrigin: z.string().default("IND"),
  isGs1Compliant: z.boolean().default(false),
  l1Size: z.coerce.number().int().min(0),
  l2Size: z.coerce.number().int().min(0),
  shipperSize: z.coerce.number().int().min(0),
  cautionLogoUrl: z.string().optional().or(z.literal("")),
  productLogoUrl: z.string().optional().or(z.literal("")),
  labelPdfUrl: z.string().optional().or(z.literal("")),
  expiryDate: z.date({ required_error: "Expiry date is required" }),
  companyId: z.coerce.number().optional(),
});

import { usePackagingHierarchyVisibility } from "@/hooks/use-packaging-hierarchy-visibility";
import { useConfirmAlerts, requestMultipleConfirmations } from "@/hooks/useConfirmAlerts";

type ProductForm = z.infer<typeof productSchema>;

export default function NewProduct() {
  const { id: idStr } = useParams<{ id?: string }>();
  const id = idStr ? parseInt(idStr, 10) : undefined;
  const isEdit = id !== undefined;

  const { confirmCount } = useConfirmAlerts();
  const { data: currentUser } = useGetCurrentUser();
  const isSuperMaster = currentUser?.role === "super_master";
  const isMaster = currentUser?.role === "master" || currentUser?.role === "super_master";
  const { data: myCompany } = useGetMyCompany({ query: { enabled: !isMaster } } as any);
  const { data: companies = [] } = useListCompanies();
  const { data: products = [] } = useListProducts();
  const product = products.find(p => p.id === id);

  const createProduct = useCreateProduct();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Local/UI Mock States for layout alignment
  const [antidote, setAntidote] = useState("");
  const [leafletPdf, setLeafletPdf] = useState<{ name: string; url: string } | null>(null);
  const [shipperQty, setShipperQty] = useState("");
  const [palletQty, setPalletQty] = useState("");
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const { hidePackagingHierarchy } = usePackagingHierarchyVisibility();

  // Track dirty state of sections
  const [dirtySections, setDirtySections] = useState<Record<string, boolean>>({});

  const markSectionDirty = (sectionName: string) => {
    setDirtySections((prev) => ({ ...prev, [sectionName]: true }));
  };

  const markSectionClean = (sectionName: string) => {
    setDirtySections((prev) => ({ ...prev, [sectionName]: false }));
  };

  const hasAnyDirtySection = Object.values(dirtySections).some(Boolean);

  // Prevent closing tab/window or navigating away if any section has unconfirmed edits
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isEdit && hasAnyDirtySection) {
        e.preventDefault();
        e.returnValue = "You have unsaved edited changes! Please confirm or save your changes before leaving.";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isEdit, hasAnyDirtySection]);

  const confirmNavigation = (targetPath: string) => {
    if (isEdit && hasAnyDirtySection) {
      const confirmLeave = window.confirm(
        "You have unconfirmed changes in one or more sections! Are you sure you want to leave without saving?"
      );
      if (!confirmLeave) return;
    }
    setLocation(targetPath);
  };

  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      skuId: "",
      name: "",
      skuSize: "",
      marketedBy: "Tracely Global Logistics",
      sapDescription: "",
      mrp: 0,
      registrationNo: "",
      hsnCode: "",
      gstRate: 18,
      unit: "Piece",
      weightValue: 0,
      weightUnit: "g",
      packagingType: "Bottle",
      shelfLifeDays: 365,
      countryOfOrigin: "IND",
      isGs1Compliant: false,
      l1Size: 0,
      l2Size: 0,
      shipperSize: 0,
      cautionLogoUrl: "Flammable",
      productLogoUrl: "",
      labelPdfUrl: "",
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      companyId: undefined,
    },
  });

  const watchName = form.watch("name");

  useEffect(() => {
    if (isEdit && product) {
      form.reset({
        skuId: product.skuId || "",
        name: product.name || "",
        skuSize: product.skuSize || "",
        marketedBy: product.marketedBy || "",
        sapDescription: product.sapDescription || "",
        mrp: product.mrp ?? 0,
        registrationNo: product.registrationNo || "",
        hsnCode: product.hsnCode || "",
        gstRate: product.gstRate ?? 18,
        unit: product.unit || "Piece",
        weightValue: product.weightValue ?? 0,
        weightUnit: product.weightUnit || "g",
        packagingType: product.packagingType || "Bottle",
        shelfLifeDays: product.shelfLifeDays ?? 365,
        countryOfOrigin: product.countryOfOrigin || "IND",
        isGs1Compliant: product.isGs1Compliant ?? false,
        l1Size: product.l1Size ?? 0,
        l2Size: product.l2Size ?? 100,
        shipperSize: product.shipperSize ?? 0,
        cautionLogoUrl: product.cautionLogoUrl || "Flammable",
        productLogoUrl: product.productLogoUrl || "",
        labelPdfUrl: product.labelPdfUrl || "",
        expiryDate: product.expiryDate ? new Date(product.expiryDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        companyId: product.companyId ?? undefined,
      });
      setDirtySections({});
    }
  }, [product, isEdit]);

  useEffect(() => {
    if (!isEdit && currentUser?.companyName && !isMaster) {
      form.setValue("marketedBy", currentUser.companyName);
    }
  }, [currentUser, isMaster, form, isEdit]);

  useEffect(() => {
    if (isEdit) return;
    const generatedSku = (watchName || "")
      .toUpperCase()
      .replace(/[^A-Z0-9\s-]/g, "")
      .trim()
      .replace(/[\s-]+/g, "-");
    form.setValue("skuId", generatedSku, { shouldValidate: true });
  }, [watchName, form, isEdit]);

  const watchL1Size = Number(form.watch("l1Size")) || 0;
  const watchShipperSize = Number(form.watch("shipperSize")) || 0;
  const watchCautionLogo = form.watch("cautionLogoUrl");

  const handleUpload = (fieldName: "productLogoUrl" | "labelPdfUrl" | "leafletPdf") => {
    const input = document.createElement("input");
    input.type = "file";
    if (fieldName === "labelPdfUrl" || fieldName === "leafletPdf") {
      input.accept = ".pdf";
    } else {
      input.accept = "image/*";
    }
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setUploadingField(fieldName);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to upload file");
        }

        const data = await response.json();
        const absoluteUrl = window.location.origin + data.url;

        if (fieldName === "leafletPdf") {
          setLeafletPdf({ name: file.name, url: absoluteUrl });
        } else {
          form.setValue(fieldName, absoluteUrl);
        }
        if (isEdit) markSectionDirty("Digital Assets");
        toast.success(`${file.name} uploaded successfully`);
      } catch (error: any) {
        toast.error(error.message || "Error uploading file");
      } finally {
        setUploadingField(null);
      }
    };
    input.click();
  };

  const getPayload = () => {
    const values = form.getValues();
    const derivedSkuSize = values.weightValue && Number(values.weightValue) > 0 
      ? `${values.weightValue} ${values.unit || "Piece"}` 
      : (values.unit || "Piece");

    const toNum = (val: any, fallback: number | null = null): number | null => {
      if (val === undefined || val === null || String(val).trim() === "") return fallback;
      const num = Number(val);
      return isNaN(num) ? fallback : num;
    };

    return {
      ...values,
      mrp: toNum(values.mrp, 0)!,
      gstRate: toNum(values.gstRate, null),
      weightValue: toNum(values.weightValue, null),
      shelfLifeDays: toNum(values.shelfLifeDays, null),
      l1Size: toNum(values.l1Size, 0)!,
      l2Size: toNum(values.l2Size, 0)!,
      shipperSize: toNum(values.shipperSize, 0)!,
      skuSize: values.skuSize || derivedSkuSize,
      unit: values.unit || "Piece",
      weightUnit: values.weightUnit || "g",
      isGs1Compliant: isSuperMaster ? values.isGs1Compliant : false,
      companyId: isMaster ? (values.companyId ? Number(values.companyId) : undefined) : currentUser?.companyId || 1,
      sapDescription: values.sapDescription || undefined,
      registrationNo: values.registrationNo || undefined,
      cautionLogoUrl: values.cautionLogoUrl || undefined,
      productLogoUrl: values.productLogoUrl || undefined,
      labelPdfUrl: values.labelPdfUrl || undefined,
      expiryDate: values.expiryDate ? format(values.expiryDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
    };
  };

  const handleSaveSection = async (sectionName: string) => {
    if (!isEdit || !id) return;
    const confirmed = await requestMultipleConfirmations(confirmCount, sectionName);
    if (!confirmed) return;

    const payload = getPayload();

    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to update ${sectionName}`);
      }
      queryClient.invalidateQueries({
        queryKey: getListProductsQueryKey(),
      });
      markSectionClean(sectionName);
      toast.success(`${sectionName} saved successfully`);
    } catch (error: any) {
      toast.error(error.message || `Failed to update ${sectionName}`);
    }
  };

  const onSubmit = (values: ProductForm) => {
    if (isMaster && !values.companyId) {
      toast.error("Please select a company to allocate this product to.");
      return;
    }

    const payload = getPayload();

    if (isEdit) {
      fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "Failed to update product");
          }
          queryClient.invalidateQueries({
            queryKey: getListProductsQueryKey(),
          });
          setDirtySections({});
          toast.success("Product updated successfully");
          setLocation("/products");
        })
        .catch((error) => {
          toast.error(error.message || "Failed to update product");
        });
    } else {
      createProduct.mutate(
        { data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: getListProductsQueryKey(),
            });
            toast.success("Product created successfully");
            setLocation("/products");
          },
          onError: (error: any) => {
            toast.error(error?.data?.error || "Failed to create product");
          },
        }
      );
    }
  };

  return (
    <Form {...form}>
      <form 
        onSubmit={form.handleSubmit(onSubmit)} 
        onChange={() => {
          // If form values are changed by user in edit mode, mark form active
        }}
        className="space-y-8 max-w-[1200px] mx-auto pb-12 font-sans"
      >
        {/* Header Block */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-[32px] font-bold text-[#0F172A] tracking-tight">
              {isEdit ? "Edit Product Master Data" : "Add Product Master Data"}
            </h1>
            <p className="text-slate-500 text-[14px] mt-1">
              {isEdit 
                ? "Update product specifications and GS1 parameters using section save buttons." 
                : "Populate GS1 compliant product specifications for unique serialization tagging."}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => confirmNavigation("/products")}
              className="px-6 py-2 border border-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors h-11"
            >
              {isEdit ? "Back to Products" : "Discard"}
            </Button>
            {!isEdit && (
              <Button
                type="submit"
                disabled={createProduct.isPending}
                className="px-6 py-2 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-[#2563EB]/20 transition-all flex items-center gap-2 active:scale-95 h-11"
              >
                <span className="material-symbols-outlined text-[20px] font-bold">save</span>
                Save Product
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* LEFT COLUMN */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            
            {/* Card 1: Product Identification */}
            <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                    <Package className="w-5 h-5" />
                  </div>
                  <h3 className="text-[16px] font-bold text-[#0F172A]">Product Identification</h3>
                  {isEdit && dirtySections["Product Identification"] && (
                    <span className="text-[11px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                      Unsaved Changes
                    </span>
                  )}
                </div>
                {isEdit && (
                  <Button
                    type="button"
                    onClick={() => handleSaveSection("Product Identification")}
                    className="px-4 py-1.5 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1.5 h-9"
                  >
                    <span className="material-symbols-outlined text-[16px]">save</span>
                    Save Product Identification
                  </Button>
                )}
              </div>

              <div className="space-y-5">
                {isMaster ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="companyId"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                            COMPANY <span className="text-[#EF4444]">*</span>
                          </FormLabel>
                          <Select 
                            onValueChange={(val) => field.onChange(Number(val))} 
                            value={field.value?.toString()}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus:border-[#2563EB] focus:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all h-auto">
                                <SelectValue placeholder="Select target company node" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {companies.map((company: any) => (
                                <SelectItem key={company.id} value={company.id.toString()}>
                                  {company.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                          {form.formState.isSubmitted && !form.watch("companyId") && (
                            <p className="text-[12px] font-medium text-destructive mt-1.5">Company must be selected</p>
                          )}
                        </FormItem>
                      )}
                    />

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                        COMPANY GST
                      </label>
                      <Input 
                        value={companies.find((c: any) => c.id === form.watch("companyId"))?.gstin || (currentUser as any)?.companyGstin || (currentUser as any)?.company?.gstin || myCompany?.gstin || ""}
                        readOnly
                        placeholder="Selected company GST" 
                        className="w-full bg-[#F1F5F9] border-[#E2E8F0] text-slate-500 rounded-lg py-2.5 px-4 text-sm transition-all font-mono cursor-not-allowed focus-visible:ring-0"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                      COMPANY GST
                    </label>
                    <Input 
                      value={myCompany?.gstin || (currentUser as any)?.companyGstin || (currentUser as any)?.company?.gstin || ""}
                      readOnly
                      placeholder="Selected company GST" 
                      className="w-full bg-[#F1F5F9] border-[#E2E8F0] text-slate-500 rounded-lg py-2.5 px-4 text-sm transition-all font-mono cursor-not-allowed focus-visible:ring-0"
                    />
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="isGs1Compliant"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                        SERIALIZATION COMPLIANCE MODE
                      </FormLabel>
                      {isSuperMaster ? (
                        <Select 
                          onValueChange={(val) => field.onChange(val === "true")} 
                          value={String(field.value)}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#2563EB] focus:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all h-auto">
                              <SelectValue placeholder="Select serialization mode" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="false">Standardized Compliance Mode (Generates secure non-GS1 serial codes)</SelectItem>
                            <SelectItem value="true">Official GS1 Compliant Mode (Requires GTIN or Company GST)</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input 
                          readOnly
                          disabled
                          value="Standardized Compliance Mode (Generates secure non-GS1 serial codes)"
                          className="w-full bg-[#F1F5F9] border-[#E2E8F0] text-slate-600 rounded-lg py-2.5 px-4 text-sm transition-all cursor-not-allowed focus-visible:ring-0 font-medium"
                        />
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                          PRODUCT NAME <span className="text-[#EF4444]">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter formal product commercial name" 
                            className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all placeholder:text-slate-400"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="skuId"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                          SKU ID 
                        </FormLabel>
                        <FormControl>
                          <Input 
                            readOnly
                            placeholder="Automatically generated from product name" 
                            className="w-full bg-[#F1F5F9] border-[#E2E8F0] text-slate-500 rounded-lg py-2.5 px-4 text-sm transition-all cursor-not-allowed focus-visible:ring-0 placeholder:text-slate-400 font-semibold"
                            {...field} 
                          />
                        </FormControl>
                        {form.formState.errors.skuId && form.watch("name") ? (
                          <FormMessage />
                        ) : null}
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                          PACKAGING TYPE
                        </FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || "Piece"}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#2563EB] focus:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all h-[42px]">
                              <SelectValue placeholder="Select Unit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Piece">Piece (Pc)</SelectItem>
                            <SelectItem value="Box">Box (Bx)</SelectItem>
                            <SelectItem value="Bottle">Bottle (Bt)</SelectItem>
                            <SelectItem value="Pack">Pack (Pk)</SelectItem>
                            <SelectItem value="Can">Can (Cn)</SelectItem>
                            <SelectItem value="Drum">Drum (Dr)</SelectItem>
                            <SelectItem value="Bag">Bag (Bg)</SelectItem>
                            <SelectItem value="Carton">Carton (Ct)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="weightUnit"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                          WEIGHT / VOLUME UNIT
                        </FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || "g"}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#2563EB] focus:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all h-[42px]">
                              <SelectValue placeholder="Select Weight / Volume Unit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="g">Grams (g)</SelectItem>
                            <SelectItem value="kg">Kilograms (kg)</SelectItem>
                            <SelectItem value="ml">Millilitres (ml)</SelectItem>
                            <SelectItem value="l">Litres (L)</SelectItem>
                            <SelectItem value="mg">Milligrams (mg)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="weightValue"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                          WEIGHT / VOLUME VALUE
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            placeholder="e.g. 500" 
                            className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all"
                            {...field} 
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="mrp"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                          MRP (UNIT PRICE)
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">&#8377;</span>
                            <Input 
                              type="number"
                              placeholder="0.00" 
                              className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 rounded-lg py-2.5 pl-8 pr-4 text-sm text-slate-900 transition-all placeholder:text-slate-400"
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="sapDescription"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                        SAP DESCRIPTION
                      </FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Technical system description from SAP ERP..." 
                          rows={3}
                          className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all placeholder:text-slate-400 resize-none"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            {/* Card 2: Regulatory Information */}
            <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h3 className="text-[16px] font-bold text-[#0F172A]">Regulatory Information</h3>
                  {isEdit && dirtySections["Regulatory Information"] && (
                    <span className="text-[11px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                      Unsaved Changes
                    </span>
                  )}
                </div>
                {isEdit && (
                  <Button
                    type="button"
                    onClick={() => handleSaveSection("Regulatory Information")}
                    className="px-4 py-1.5 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1.5 h-9"
                  >
                    <span className="material-symbols-outlined text-[16px]">save</span>
                    Save Regulatory Information
                  </Button>
                )}
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="registrationNo"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                          REGISTRATION NO.
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="ISO/REG/9920/1" 
                            className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all placeholder:text-slate-400"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="marketedBy"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                          MARKETED BY
                        </FormLabel>
                        <Select disabled={isEdit} onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#2563EB] focus:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all h-[42px]">
                              <SelectValue placeholder="Select company" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {companies.map((c) => (
                              <SelectItem key={c.id} value={c.name}>
                                {c.name}
                              </SelectItem>
                            ))}
                            {currentUser?.companyName && !companies.some((c) => c.name === currentUser.companyName) && (
                              <SelectItem value={currentUser.companyName}>
                                {currentUser.companyName}
                              </SelectItem>
                            )}
                            {field.value &&
                              field.value !== currentUser?.companyName &&
                              !companies.some((c) => c.name === field.value) && (
                                <SelectItem value={field.value}>
                                  {field.value}
                                </SelectItem>
                              )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                    ANTIDOTE STATEMENT
                  </label>
                  <Textarea 
                    placeholder="Specify emergency procedures and antidote requirements for hazardous handling..." 
                    rows={3}
                    value={antidote}
                    onChange={(e) => setAntidote(e.target.value)}
                    className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all placeholder:text-slate-400 resize-none"
                  />
                </div>

                <FormField
                  control={form.control}
                  name="cautionLogoUrl"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                        CAUTION LOGO SELECTION
                      </FormLabel>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        {[
                          { name: "N/A", icon: Ban, color: "text-slate-400", bg: "bg-slate-100" },
                          { name: "Flammable", icon: Flame, color: "text-red-500", bg: "bg-red-50" },
                          { name: "Toxic", icon: Skull, color: "text-slate-600", bg: "bg-slate-50" },
                          { name: "Eco-Hazard", icon: Leaf, color: "text-emerald-500", bg: "bg-emerald-50" },
                          { name: "Cold Chain", icon: Snowflake, color: "text-blue-500", bg: "bg-blue-50" }
                        ].map((logo) => {
                          const IconComponent = logo.icon;
                          const isActive = watchCautionLogo === logo.name;
                          return (
                            <button
                              key={logo.name}
                              type="button"
                              onClick={() => field.onChange(logo.name)}
                              className={cn(
                                "flex flex-col items-center justify-center p-4 border rounded-xl gap-2 transition-all cursor-pointer",
                                isActive 
                                  ? "border-[#2563EB] bg-[#F0F6FF] ring-1 ring-[#2563EB]" 
                                  : "border-[#E2E8F0] bg-white hover:bg-slate-50"
                              )}
                            >
                              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", logo.bg)}>
                                <IconComponent className={cn("w-4 h-4", logo.color)} />
                              </div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">{logo.name}</span>
                            </button>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            {/* Card 3: Tax, Physical Metrics & Packaging */}
            <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h3 className="text-[16px] font-bold text-[#0F172A]">Tax, Physical Metrics & Packaging</h3>
                  {isEdit && dirtySections["Tax, Physical Metrics & Packaging"] && (
                    <span className="text-[11px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                      Unsaved Changes
                    </span>
                  )}
                </div>
                {isEdit && (
                  <Button
                    type="button"
                    onClick={() => handleSaveSection("Tax, Physical Metrics & Packaging")}
                    className="px-4 py-1.5 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1.5 h-9"
                  >
                    <span className="material-symbols-outlined text-[16px]">save</span>
                    Save Tax & Physical Metrics
                  </Button>
                )}
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="hsnCode"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                          HSN CODE (TAX CLASSIFICATION)
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g. 38089190" 
                            className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all font-mono"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>


              </div>
            </section>
          </div>

          {/* RIGHT COLUMN */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            
            {/* Card 3: Packaging Hierarchy */}
            {!hidePackagingHierarchy && (
              <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#F0F6FF] flex items-center justify-center text-blue-600">
                      <Layers className="w-5 h-5" />
                    </div>
                    <h3 className="text-[16px] font-bold text-[#0F172A]">Packaging Hierarchy</h3>
                    {isEdit && dirtySections["Packaging Hierarchy"] && (
                      <span className="text-[11px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                        Unsaved Changes
                      </span>
                    )}
                  </div>
                  {isEdit && (
                    <Button
                      type="button"
                      onClick={() => handleSaveSection("Packaging Hierarchy")}
                      className="px-4 py-1.5 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1.5 h-9"
                    >
                      <span className="material-symbols-outlined text-[16px]">save</span>
                      Save Hierarchy
                    </Button>
                  )}
                </div>

                <div className="space-y-6">
                  
                  {/* Shipper Section */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-800">SHIPPER</span>
                      <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wider">QR/SHIPPER</span>
                    </div>
                    <p className="text-xs text-slate-500">How many QR codes should be entered for 1 Shipper?</p>
                    
                    <div className="flex items-center gap-3">
                      <FormField
                        control={form.control}
                        name="l1Size"
                        render={({ field }) => (
                          <FormItem className="w-24">
                            <FormControl>
                              <Input 
                                type="number"
                                className="bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 text-center font-semibold text-sm"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <span className="text-xs text-slate-400 font-medium">QR</span>
                      <span className="text-slate-400 font-bold">=</span>
                      <div className="w-16 bg-slate-100 border border-slate-200 text-center font-semibold text-sm py-2 rounded-lg text-slate-500 select-none">
                        1
                      </div>
                      <span className="text-xs text-slate-400 font-medium">SHP</span>
                    </div>
                    <p className="text-[10px] text-slate-400 italic font-medium">{watchL1Size} QR Codes = 1 Shipper</p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase block">SHIPPER REQUEST</label>
                    <p className="text-xs text-slate-500 mb-1">How many shippers do you need?</p>
                    <div className="relative">
                      <Input 
                        placeholder="Enter quantity"
                        value={shipperQty}
                        onChange={(e) => setShipperQty(e.target.value)}
                        className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 rounded-lg py-2 px-4 pr-12 text-sm text-slate-900 transition-all placeholder:text-slate-400"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">QTY</span>
                    </div>
                  </div>

                  {/* Pallet Section */}
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-800">PALLET</span>
                      <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wider">SHIPPERS/PALLET</span>
                    </div>
                    <p className="text-xs text-slate-500">How many Shipper codes should be entered for 1 Pallet?</p>
                    
                    <div className="flex items-center gap-3">
                      <FormField
                        control={form.control}
                        name="shipperSize"
                        render={({ field }) => (
                          <FormItem className="w-24">
                            <FormControl>
                              <Input 
                                type="number"
                                className="bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 text-center font-semibold text-sm"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <span className="text-xs text-slate-400 font-medium">SHP</span>
                      <span className="text-slate-400 font-bold">=</span>
                      <div className="w-16 bg-slate-100 border border-slate-200 text-center font-semibold text-sm py-2 rounded-lg text-slate-500 select-none">
                        1
                      </div>
                      <span className="text-xs text-slate-400 font-medium">PLT</span>
                    </div>
                    <p className="text-[10px] text-slate-400 italic font-medium">{watchShipperSize} Shipper Codes = 1 Pallet</p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase block">PALLET REQUEST</label>
                    <p className="text-xs text-slate-500 mb-1">How many pallets do you need?</p>
                    <div className="relative">
                      <Input 
                        placeholder="Enter quantity"
                        value={palletQty}
                        onChange={(e) => setPalletQty(e.target.value)}
                        className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 rounded-lg py-2 px-4 pr-12 text-sm text-slate-900 transition-all placeholder:text-slate-400"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">QTY</span>
                    </div>
                  </div>

                </div>
              </section>
            )}

            {/* Card 4: Digital Assets */}
            <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                    <CloudUpload className="w-5 h-5" />
                  </div>
                  <h3 className="text-[16px] font-bold text-[#0F172A]">Digital Assets</h3>
                  {isEdit && dirtySections["Digital Assets"] && (
                    <span className="text-[11px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                      Unsaved Changes
                    </span>
                  )}
                </div>
                {isEdit && (
                  <Button
                    type="button"
                    onClick={() => handleSaveSection("Digital Assets")}
                    className="px-4 py-1.5 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1.5 h-9"
                  >
                    <span className="material-symbols-outlined text-[16px]">save</span>
                    Save Digital Assets
                  </Button>
                )}
              </div>

              {/* Product Logo upload zone */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">PRODUCT LOGO (.SVG, .PNG)</label>
                <FormField
                  control={form.control}
                  name="productLogoUrl"
                  render={({ field }) => (
                    <FormItem>
                      {field.value ? (
                        <div className="border border-slate-200 rounded-xl p-3 flex items-center justify-between bg-slate-50">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <img src={field.value} alt="Product Logo" className="w-8 h-8 object-contain rounded border bg-white" />
                            <span className="text-xs text-slate-600 truncate">{field.value.split("/").pop()}</span>
                          </div>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => field.onChange("")}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div 
                          onClick={() => handleUpload("productLogoUrl")}
                          className="border-2 border-dashed border-slate-200 rounded-xl py-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-50 transition-colors"
                        >
                          {uploadingField === "productLogoUrl" ? (
                            <Loader2 className="h-6 w-6 animate-spin text-[#2563EB]" />
                          ) : (
                            <CloudUpload className="h-6 w-6 text-slate-400" />
                          )}
                          <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                            {uploadingField === "productLogoUrl" ? "Uploading..." : "DRAG OR CLICK TO UPLOAD"}
                          </span>
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Label PDF file block */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">LABEL PDF</label>
                <FormField
                  control={form.control}
                  name="labelPdfUrl"
                  render={({ field }) => (
                    <FormItem>
                      {field.value ? (
                        <div className="border border-slate-200 rounded-xl p-3 flex items-center justify-between bg-slate-50">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="material-symbols-outlined text-red-500">picture_as_pdf</span>
                            <div className="flex flex-col overflow-hidden">
                              <span className="text-xs font-semibold text-slate-700 truncate">{field.value.split("/").pop()}</span>
                              <span className="text-[10px] text-slate-400 font-medium">Uploaded</span>
                            </div>
                          </div>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => field.onChange("")}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div 
                          onClick={() => handleUpload("labelPdfUrl")}
                          className="border border-[#E2E8F0] rounded-xl p-3 flex items-center justify-between bg-[#F8FAFC] hover:bg-slate-50 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-400">picture_as_pdf</span>
                            <span className="text-xs text-slate-400">No file selected</span>
                          </div>
                          {uploadingField === "labelPdfUrl" ? (
                            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                          ) : (
                            <Plus className="h-4 w-4 text-slate-400" />
                          )}
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Leaflet PDF file block */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">LEAFLET PDF</label>
                {leafletPdf ? (
                  <div className="border border-slate-200 rounded-xl p-3 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="material-symbols-outlined text-red-500">picture_as_pdf</span>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-xs font-semibold text-slate-700 truncate">{leafletPdf.name}</span>
                        <span className="text-[10px] text-slate-400 font-medium">Uploaded</span>
                      </div>
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setLeafletPdf(null)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div 
                    onClick={() => handleUpload("leafletPdf")}
                    className="border border-[#E2E8F0] rounded-xl p-3 flex items-center justify-between bg-[#F8FAFC] hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-slate-400">picture_as_pdf</span>
                      <span className="text-xs text-slate-400">No file selected</span>
                    </div>
                    {uploadingField === "leafletPdf" ? (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    ) : (
                      <Plus className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                )}
              </div>

            </section>
          </div>
        </div>
      </form>
    </Form>
  );
}

import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListLocations,
  getListLocationsQueryKey,
  useCreateLocation,
  useDeleteLocation,
  useGetCurrentUser,
  useListCompanies,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Trash2, Plus, MapPin, Edit } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const locationSchema = z.object({
  locationType: z.string().min(1, "Type is required"),
  uniqueName: z.string().min(1, "Unique name is required"),
  locationName: z.string().min(1, "Location name is required"),
  contactNo: z.string().min(1, "Contact number is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
});

type LocationForm = z.infer<typeof locationSchema>;

export default function Locations() {
  const [, setLocation] = useLocation();
  const { data: currentUser } = useGetCurrentUser();
  const isMaster = currentUser?.role === "master" || currentUser?.role === "super_master";
  const { data: companies = [] } = useListCompanies({ query: { enabled: isMaster } } as any);
  const { data: locations = [], isLoading } = useListLocations();
  const createLocation = useCreateLocation();
  const deleteLocation = useDeleteLocation();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const form = useForm<LocationForm>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      locationType: "Warehouse",
      uniqueName: "",
      locationName: "",
      contactNo: "",
      address: "",
      city: "",
      state: "",
    },
  });

  const onSubmit = (values: LocationForm) => {
    createLocation.mutate(
      { data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListLocationsQueryKey(),
          });
          toast.success("Location created");
          setIsCreateOpen(false);
          form.reset();
        },
        onError: (error: any) => {
          toast.error(error?.data?.error || "Failed to create location");
        },
      },
    );
  };

  const handleDelete = (id: number) => {
    deleteLocation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListLocationsQueryKey(),
          });
          toast.success("Location deleted");
        },
        onError: (error: any) => {
          toast.error(error?.data?.error || "Failed to delete location");
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-center gap-2 text-slate-500">
        <a className="text-[11px] font-bold hover:text-[#2563EB] transition-colors uppercase tracking-wider cursor-pointer" href="#">Admin Terminal</a>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-[11px] text-[#2563EB] uppercase tracking-wider font-bold">Facilities</span>
      </div>
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-[30px] leading-[36px] font-bold text-[#0F172A] tracking-[-0.02em]">Factory Location</h2>
          <p className="text-[16px] text-slate-600 mt-1">Manage physical company nodes, warehouses, and assembly lines.</p>
        </div>

        <Button 
          onClick={() => setLocation("/locations/new")}
          className="px-6 py-2.5 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-[#2563EB]/20 transition-all flex items-center gap-2 active:scale-95 h-auto cursor-pointer"
        >
          <Plus className="mr-2 h-4 w-4" /> Add Factory
        </Button>
      </div>

      {/* Main Table Container */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 border-b border-[#E2E8F0] bg-[#faf8ff] flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <span className="text-[18px] font-semibold text-[#0F172A]">Registered Facilities</span>
            <span className="bg-[#ededf9] text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">Active</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-500">
              <span className="material-symbols-outlined">filter_list</span>
            </button>
            <button className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-500">
              <span className="material-symbols-outlined">download</span>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table className="w-full text-left table-fixed">
            <TableHeader>
              <TableRow className="border-b border-[#E2E8F0] bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="text-slate-500 tracking-wider w-[18%] text-[11px] font-bold px-6 py-4 uppercase">LOCATION NAME</TableHead>
                {isMaster && <TableHead className="text-slate-500 tracking-wider w-[15%] text-[11px] font-bold px-6 py-4 uppercase">COMPANY</TableHead>}
                <TableHead className="text-slate-500 tracking-wider w-[12%] text-[11px] font-bold px-6 py-4 uppercase">TYPE</TableHead>
                <TableHead className="text-slate-500 tracking-wider w-[15%] text-[11px] font-bold px-6 py-4 uppercase">UNIQUE ID</TableHead>
                <TableHead className="text-slate-500 tracking-wider w-[15%] text-[11px] font-bold px-6 py-4 uppercase">CONTACT NO.</TableHead>
                <TableHead className="text-slate-500 tracking-wider w-[15%] text-[11px] font-bold px-6 py-4 uppercase">ADDRESS</TableHead>
                <TableHead className="text-slate-500 tracking-wider w-[10%] text-[11px] font-bold px-6 py-4 uppercase text-right">ACTION</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-[#E2E8F0]">
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={isMaster ? 7 : 6} className="text-center py-8 text-xs text-slate-400">
                    Loading facility registry...
                  </TableCell>
                </TableRow>
              ) : locations.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isMaster ? 7 : 6}
                    className="text-center py-12 text-slate-400"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <MapPin className="h-8 w-8 text-slate-300" />
                      <p className="text-[14px] font-semibold text-slate-500">No active manufacturing or distribution locations registered yet</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                locations.map((location) => {
                  const companyObj = companies.find((c: any) => c.id === location.companyId);
                  return (
                    <TableRow key={location.id} className="hover:bg-slate-50 transition-colors group border-0">
                      <TableCell className="align-middle px-6 py-5">
                        <span className="text-[#0F172A] font-bold text-[14px]">
                          {location.locationName}
                        </span>
                      </TableCell>
                      {isMaster && (
                        <TableCell className="align-middle px-6 py-5 text-[13px]">
                          {companyObj ? (
                            <Badge variant="outline" className="font-semibold text-slate-700 bg-slate-100 border-slate-200">
                              {companyObj.name}
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-400 italic">System / Global</span>
                          )}
                        </TableCell>
                      )}
                    <TableCell className="align-middle px-6 py-5">
                      <Badge className="text-[10px] font-bold tracking-widest uppercase bg-[#E2E8F0] text-[#0F172A] hover:bg-[#cbd5e1] border-none shadow-none h-5 px-1.5">
                        {location.locationType}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-middle px-6 py-5 text-[14px]">
                      <span className="font-semibold tracking-wide text-slate-600">
                        {location.uniqueName}
                      </span>
                    </TableCell>
                    <TableCell className="align-middle px-6 py-5 text-[14px]">
                      <span className="text-slate-600 block">
                        {location.contactNo}
                      </span>
                    </TableCell>
                    <TableCell className="align-middle px-6 py-5 text-[14px]">
                      <span className="text-slate-600 truncate block max-w-[180px]" title={location.address}>
                        {location.address}
                      </span>
                      <span className="text-[12px] font-semibold text-slate-500 tracking-wide mt-0.5 block">{location.city}, {location.state}</span>
                    </TableCell>
                    <TableCell className="align-middle px-6 py-5 text-right flex items-center justify-end gap-1">
                      <button 
                        onClick={() => setLocation(`/locations/${location.id}/edit`)}
                        className="p-2 text-slate-500 hover:text-[#2563EB] hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                        title="Edit location"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer">
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete location</AlertDialogTitle>
                            <AlertDialogDescription>
                              Permanently remove {location.locationName}.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(location.id)}
                              className="bg-red-600 hover:bg-red-700 text-white font-bold"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>

  );
}

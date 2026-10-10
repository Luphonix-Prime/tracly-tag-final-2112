CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"address" text NOT NULL,
	"gstin" text,
	"subscription_plan" text NOT NULL,
	"subscription_status" text NOT NULL,
	"subscription_expires_at" text,
	"razorpay_order_id" text,
	"razorpay_payment_id" text,
	"company_url" text,
	"api_key" text,
	"pan" text,
	"cin" text,
	"msme_registration_no" text,
	"fssai_license_no" text,
	"drug_license_no" text,
	"iec_code" text,
	"company_prefix" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"company_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"enabled_modules" text DEFAULT 'dashboard,companies,users,products,locations,batches,generate_codes,mapping_code,customer_scan,summary,reports' NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer,
	"sku_id" text NOT NULL,
	"name" text NOT NULL,
	"sku_size" text NOT NULL,
	"marketed_by" text NOT NULL,
	"sap_description" text,
	"gtin" text,
	"mrp" double precision NOT NULL,
	"registration_no" text,
	"hsn_code" text,
	"gst_rate" double precision,
	"unit" text,
	"weight_value" double precision,
	"weight_unit" text,
	"packaging_type" text,
	"shelf_life_days" integer,
	"country_of_origin" text,
	"is_gs1_compliant" boolean DEFAULT false,
	"l1_size" integer NOT NULL,
	"l2_size" integer NOT NULL,
	"shipper_size" integer NOT NULL,
	"caution_logo_url" text,
	"product_logo_url" text,
	"label_pdf_url" text,
	"expiry_date" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer,
	"location_type" text NOT NULL,
	"unique_name" text NOT NULL,
	"location_name" text NOT NULL,
	"contact_no" text NOT NULL,
	"state" text NOT NULL,
	"city" text NOT NULL,
	"address" text NOT NULL,
	"gln" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"batch_number" text NOT NULL,
	"mfg_date" text NOT NULL,
	"expiry_date" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "batches_product_id_batch_number_unique" UNIQUE("product_id","batch_number")
);
--> statement-breakpoint
CREATE TABLE "codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"batch_id" integer,
	"level" text NOT NULL,
	"raw_string" text NOT NULL,
	"serial_number" text,
	"sscc_code" text,
	"mapped" boolean DEFAULT false NOT NULL,
	"mapped_at" text,
	"mapped_by_user_id" integer,
	"location_id" integer,
	"created_at" text NOT NULL,
	CONSTRAINT "codes_raw_string_unique" UNIQUE("raw_string")
);
--> statement-breakpoint
CREATE TABLE "passkeys" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "passkeys_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
CREATE TABLE "device_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_code" text NOT NULL,
	"user_code" text NOT NULL,
	"user_id" integer,
	"status" text NOT NULL,
	"expires_at" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "device_codes_device_code_unique" UNIQUE("device_code"),
	CONSTRAINT "device_codes_user_code_unique" UNIQUE("user_code")
);
--> statement-breakpoint
CREATE TABLE "customer_scans" (
	"id" serial PRIMARY KEY NOT NULL,
	"code_id" integer NOT NULL,
	"customer_name" text NOT NULL,
	"mobile_number" text NOT NULL,
	"zip_code" text NOT NULL,
	"city" text NOT NULL,
	"scan_time" text NOT NULL,
	"scan_date" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "counter" (
	"id" serial PRIMARY KEY NOT NULL,
	"code_id" integer NOT NULL,
	"raw_link" text NOT NULL,
	"scan_count" integer DEFAULT 1 NOT NULL,
	"first_scanned_at" text NOT NULL,
	"last_scanned_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_configs" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sso_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"phone" text,
	"provider" text DEFAULT 'SSO' NOT NULL,
	"company_name" text,
	"requested_role" text DEFAULT 'operator' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codes" ADD CONSTRAINT "codes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codes" ADD CONSTRAINT "codes_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codes" ADD CONSTRAINT "codes_mapped_by_user_id_users_id_fk" FOREIGN KEY ("mapped_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codes" ADD CONSTRAINT "codes_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_codes" ADD CONSTRAINT "device_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_scans" ADD CONSTRAINT "customer_scans_code_id_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counter" ADD CONSTRAINT "counter_code_id_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."codes"("id") ON DELETE cascade ON UPDATE no action;
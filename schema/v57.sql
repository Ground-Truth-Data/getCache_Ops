CREATE TABLE `allocationTable` (
	`versionKey` text PRIMARY KEY NOT NULL,
	`blockKey` text NOT NULL,
	`treesQty` real,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	`cropKey` text,
	`workMode` text NOT NULL,
	`createdAt` text DEFAULT '' NOT NULL,
	`replacesKey` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`actKey` text NOT NULL,
	`allocatedByKey` text NOT NULL,
	FOREIGN KEY (`blockKey`) REFERENCES `blockEntity`(`blockKey`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`allocatedByKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`cropKey`,`workMode`) REFERENCES `cropEntity`(`cropKey`,`workMode`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "allocationTable_workMode" CHECK("allocationTable"."workMode" IN ('planting', 'fruit', 'cones', 'seeds', 'shrooms')),
	CONSTRAINT "allocationTable_treesQty" CHECK("allocationTable"."treesQty" >= 0)
);
--> statement-breakpoint
CREATE INDEX `allocationTable_key_idx` ON `allocationTable` (`blockKey`);--> statement-breakpoint
CREATE INDEX `allocationTable_replaces_idx` ON `allocationTable` (`replacesKey`);--> statement-breakpoint
CREATE TABLE `appState` (
	`appStateId` text PRIMARY KEY NOT NULL,
	`gridMode` text DEFAULT 'off' NOT NULL,
	`isGridFine` integer DEFAULT 1 NOT NULL,
	`lastBlockConfirmAt` text,
	`lastParityResetAt` text,
	`blockKey` text,
	`mapFeatureKey` text,
	`mapKey` text,
	`qaSurveyKey` text,
	`selfKey` text NOT NULL,
	FOREIGN KEY (`blockKey`) REFERENCES `blockEntity`(`blockKey`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`mapFeatureKey`) REFERENCES `mapFeatureEntity`(`mapFeatureKey`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`mapKey`) REFERENCES `mapEntity`(`mapKey`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`qaSurveyKey`) REFERENCES `qaSurveyEntity`(`qaSurveyKey`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`selfKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `bagEntity` (
	`bagKey` text PRIMARY KEY NOT NULL,
	`workMode` text NOT NULL,
	`createdAt` text NOT NULL,
	`createdByKey` text NOT NULL,
	FOREIGN KEY (`createdByKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "bagEntity_workMode" CHECK("bagEntity"."workMode" IN ('planting', 'fruit', 'cones', 'seeds', 'shrooms'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bagEntity_mode_key` ON `bagEntity` (`bagKey`,`workMode`);--> statement-breakpoint
CREATE TABLE `bagTable` (
	`versionKey` text PRIMARY KEY NOT NULL,
	`bagKey` text NOT NULL,
	`boxQty` real,
	`bundleQty` real,
	`pricePerTree` real,
	`currency` text,
	`isBox` integer DEFAULT 0 NOT NULL,
	`isBagged` integer DEFAULT 0 NOT NULL,
	`bundlesInBags` integer DEFAULT 0 NOT NULL,
	`bundlesOnGround` integer DEFAULT 0 NOT NULL,
	`halfBoxParity` text DEFAULT '' NOT NULL,
	`sortOrder` text DEFAULT '' NOT NULL,
	`cropKey` text NOT NULL,
	`workMode` text NOT NULL,
	`createdAt` text DEFAULT '' NOT NULL,
	`replacesKey` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`actKey` text NOT NULL,
	`editedByKey` text NOT NULL,
	FOREIGN KEY (`editedByKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`bagKey`,`workMode`) REFERENCES `bagEntity`(`bagKey`,`workMode`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cropKey`,`workMode`) REFERENCES `cropEntity`(`cropKey`,`workMode`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bagTable_workMode" CHECK("bagTable"."workMode" IN ('planting', 'fruit', 'cones', 'seeds', 'shrooms')),
	CONSTRAINT "bagTable_counts" CHECK(("bagTable"."boxQty" IS NULL OR "bagTable"."boxQty" >= 0)
			  AND ("bagTable"."bundleQty" IS NULL OR "bagTable"."bundleQty" >= 0)),
	CONSTRAINT "bagTable_currency" CHECK(("bagTable"."currency" IS NOT NULL AND "bagTable"."currency" GLOB '[A-Z][A-Z][A-Z]') OR ("bagTable"."currency" IS NULL AND "bagTable"."pricePerTree" IS NULL)),
	CONSTRAINT "bagTable_halfBoxParity" CHECK("bagTable"."halfBoxParity" IN ('', 'small', 'big')),
	CONSTRAINT "bagTable_bagged_has_trees" CHECK("bagTable"."isBagged" = 0
			  OR COALESCE("bagTable"."boxQty", 0) > 0
			  OR COALESCE("bagTable"."bundleQty", 0) > 0),
	CONSTRAINT "bagTable_bag_split" CHECK("bagTable"."bundlesInBags" >= 0 AND "bagTable"."bundlesOnGround" >= 0
			  AND (CASE WHEN "bagTable"."isBagged" = 0
			            THEN "bagTable"."bundlesInBags" = 0 AND "bagTable"."bundlesOnGround" = 0
			            ELSE "bagTable"."bundlesInBags" + "bagTable"."bundlesOnGround" > 0 END))
);
--> statement-breakpoint
CREATE INDEX `bagTable_key_idx` ON `bagTable` (`bagKey`);--> statement-breakpoint
CREATE INDEX `bagTable_replaces_idx` ON `bagTable` (`replacesKey`);--> statement-breakpoint
CREATE TABLE `bagUpEntity` (
	`bagUpKey` text PRIMARY KEY NOT NULL,
	`bagNo` integer DEFAULT 0 NOT NULL,
	`workMode` text NOT NULL,
	`createdAt` text NOT NULL,
	`createdByKey` text NOT NULL,
	FOREIGN KEY (`createdByKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "bagUpEntity_workMode" CHECK("bagUpEntity"."workMode" IN ('planting', 'fruit', 'cones', 'seeds', 'shrooms'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bagUpEntity_mode_key` ON `bagUpEntity` (`bagUpKey`,`workMode`);--> statement-breakpoint
CREATE TABLE `bagUpTable` (
	`versionKey` text PRIMARY KEY NOT NULL,
	`bagUpKey` text NOT NULL,
	`plantedDt` text DEFAULT '' NOT NULL,
	`workMode` text NOT NULL,
	`blockKey` text,
	`mapFeatureKey` text,
	`createdAt` text DEFAULT '' NOT NULL,
	`replacesKey` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`actKey` text NOT NULL,
	`editedByKey` text NOT NULL,
	FOREIGN KEY (`blockKey`) REFERENCES `blockEntity`(`blockKey`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`mapFeatureKey`) REFERENCES `mapFeatureEntity`(`mapFeatureKey`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`editedByKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`bagUpKey`,`workMode`) REFERENCES `bagUpEntity`(`bagUpKey`,`workMode`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bagUpTable_workMode" CHECK("bagUpTable"."workMode" IN ('planting', 'fruit', 'cones', 'seeds', 'shrooms')),
	CONSTRAINT "bagUpTable_plantedDt" CHECK("bagUpTable"."plantedDt" = '' OR "bagUpTable"."plantedDt" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);
--> statement-breakpoint
CREATE INDEX `bagUpTable_key_idx` ON `bagUpTable` (`bagUpKey`);--> statement-breakpoint
CREATE INDEX `bagUpTable_parent_idx` ON `bagUpTable` (`replacesKey`,`bagUpKey`);--> statement-breakpoint
CREATE TABLE `blockEntity` (
	`blockKey` text PRIMARY KEY NOT NULL,
	`createdAt` text NOT NULL,
	`createdByKey` text NOT NULL,
	FOREIGN KEY (`createdByKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `blockTable` (
	`versionKey` text PRIMARY KEY NOT NULL,
	`blockKey` text NOT NULL,
	`blockName` text DEFAULT '' NOT NULL,
	`treesPerHa` real,
	`mapFeatureKey` text,
	`createdAt` text DEFAULT '' NOT NULL,
	`replacesKey` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`actKey` text NOT NULL,
	`editedByKey` text NOT NULL,
	FOREIGN KEY (`blockKey`) REFERENCES `blockEntity`(`blockKey`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mapFeatureKey`) REFERENCES `mapFeatureEntity`(`mapFeatureKey`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`editedByKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `blockTable_key_idx` ON `blockTable` (`blockKey`);--> statement-breakpoint
CREATE INDEX `blockTable_parent_idx` ON `blockTable` (`replacesKey`,`blockKey`);--> statement-breakpoint
CREATE TABLE `crewTable` (
	`versionKey` text PRIMARY KEY NOT NULL,
	`mapFeatureKey` text NOT NULL,
	`memberKey` text NOT NULL,
	`createdAt` text DEFAULT '' NOT NULL,
	`replacesKey` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`actKey` text NOT NULL,
	FOREIGN KEY (`mapFeatureKey`) REFERENCES `mapFeatureEntity`(`mapFeatureKey`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`memberKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `crewTable_key_idx` ON `crewTable` (`mapFeatureKey`);--> statement-breakpoint
CREATE INDEX `crewTable_replaces_idx` ON `crewTable` (`replacesKey`);--> statement-breakpoint
CREATE TABLE `cropEntity` (
	`cropKey` text PRIMARY KEY NOT NULL,
	`workMode` text NOT NULL,
	`createdAt` text NOT NULL,
	`createdByKey` text NOT NULL,
	FOREIGN KEY (`createdByKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "cropEntity_workMode" CHECK("cropEntity"."workMode" IN ('planting', 'fruit', 'cones', 'seeds', 'shrooms'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cropEntity_mode_key` ON `cropEntity` (`cropKey`,`workMode`);--> statement-breakpoint
CREATE TABLE `cropTable` (
	`versionKey` text PRIMARY KEY NOT NULL,
	`cropKey` text NOT NULL,
	`workMode` text NOT NULL,
	`boxTag` text DEFAULT '' NOT NULL,
	`speciesKey` text DEFAULT '' NOT NULL,
	`container` text,
	`boxSizeQty` real,
	`bundleSizeQty` real,
	`createdAt` text DEFAULT '' NOT NULL,
	`replacesKey` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`actKey` text NOT NULL,
	`editedByKey` text NOT NULL,
	FOREIGN KEY (`editedByKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`cropKey`,`workMode`) REFERENCES `cropEntity`(`cropKey`,`workMode`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "cropTable_workMode" CHECK("cropTable"."workMode" IN ('planting', 'fruit', 'cones', 'seeds', 'shrooms')),
	CONSTRAINT "cropTable_container" CHECK("cropTable"."container" IS NULL OR "cropTable"."container" IN ('box', 'tray', 'singles', 'bag', 'bundle', 'stakes')),
	CONSTRAINT "cropTable_sizes" CHECK(("cropTable"."boxSizeQty" IS NULL OR "cropTable"."boxSizeQty" > 0)
			  AND ("cropTable"."bundleSizeQty" IS NULL OR "cropTable"."bundleSizeQty" > 0))
);
--> statement-breakpoint
CREATE INDEX `cropTable_key_idx` ON `cropTable` (`cropKey`);--> statement-breakpoint
CREATE INDEX `cropTable_parent_idx` ON `cropTable` (`replacesKey`,`cropKey`);--> statement-breakpoint
CREATE TABLE `deliveryTable` (
	`versionKey` text PRIMARY KEY NOT NULL,
	`mapFeatureKey` text NOT NULL,
	`cropKey` text NOT NULL,
	`workMode` text NOT NULL,
	`deliveryKind` text NOT NULL,
	`lat` real,
	`lng` real,
	`accuracyM` real,
	`distanceM` real,
	`createdAt` text DEFAULT '' NOT NULL,
	`replacesKey` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`actKey` text NOT NULL,
	`deliveredByKey` text NOT NULL,
	FOREIGN KEY (`mapFeatureKey`) REFERENCES `mapFeatureEntity`(`mapFeatureKey`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deliveredByKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`cropKey`,`workMode`) REFERENCES `cropEntity`(`cropKey`,`workMode`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "deliveryTable_workMode" CHECK("deliveryTable"."workMode" IN ('planting', 'fruit', 'cones', 'seeds', 'shrooms')),
	CONSTRAINT "deliveryTable_deliveryKind" CHECK("deliveryTable"."deliveryKind" IN ('delivered', 'closed')),
	CONSTRAINT "deliveryTable_delivered_has_a_fix" CHECK("deliveryTable"."deliveryKind" = 'closed' OR ("deliveryTable"."lat" IS NOT NULL AND "deliveryTable"."lng" IS NOT NULL AND "deliveryTable"."distanceM" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `deliveryTable_key_idx` ON `deliveryTable` (`mapFeatureKey`,`cropKey`);--> statement-breakpoint
CREATE INDEX `deliveryTable_replaces_idx` ON `deliveryTable` (`replacesKey`);--> statement-breakpoint
CREATE TABLE `deviceKeyTable` (
	`deviceKey` text NOT NULL,
	`personKey` text NOT NULL,
	PRIMARY KEY(`deviceKey`, `personKey`),
	FOREIGN KEY (`personKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `deviceKeyTable_person_idx` ON `deviceKeyTable` (`personKey`);--> statement-breakpoint
CREATE TABLE `editNoteTable` (
	`noteKey` text PRIMARY KEY NOT NULL,
	`tableName` text NOT NULL,
	`rowKey` text NOT NULL,
	`reason` text NOT NULL,
	`actKey` text NOT NULL,
	`createdAt` text NOT NULL,
	`createdByKey` text NOT NULL,
	FOREIGN KEY (`createdByKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "editNoteTable_named" CHECK("editNoteTable"."tableName" <> '' AND "editNoteTable"."rowKey" <> ''),
	CONSTRAINT "editNoteTable_reason" CHECK(trim("editNoteTable"."reason") <> '')
);
--> statement-breakpoint
CREATE INDEX `editNoteTable_row_idx` ON `editNoteTable` (`rowKey`,`createdAt`);--> statement-breakpoint
CREATE TABLE `mapEntity` (
	`mapKey` text PRIMARY KEY NOT NULL,
	`createdAt` text NOT NULL,
	`createdByKey` text NOT NULL,
	FOREIGN KEY (`createdByKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `mapFeatureEntity` (
	`mapFeatureKey` text PRIMARY KEY NOT NULL,
	`workMode` text,
	`createdAt` text NOT NULL,
	`createdByKey` text NOT NULL,
	FOREIGN KEY (`createdByKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "mapFeatureEntity_workMode" CHECK("mapFeatureEntity"."workMode" IS NULL OR "mapFeatureEntity"."workMode" IN ('planting', 'fruit', 'cones', 'seeds', 'shrooms'))
);
--> statement-breakpoint
CREATE TABLE `mapFeatureTable` (
	`versionKey` text PRIMARY KEY NOT NULL,
	`mapFeatureKey` text NOT NULL,
	`featureName` text DEFAULT '' NOT NULL,
	`featureType` text DEFAULT 'polygon' NOT NULL,
	`geometryJson` text,
	`featureDesc` text,
	`featureDataJson` text,
	`pinIcon` text DEFAULT '' NOT NULL,
	`fillOpacity` real,
	`isTitleShown` integer DEFAULT 0 NOT NULL,
	`overlayJson` text DEFAULT '' NOT NULL,
	`featureOrigin` text DEFAULT 'drawn' NOT NULL,
	`mapKey` text NOT NULL,
	`linkedBlockKey` text,
	`mergedFromJson` text DEFAULT '' NOT NULL,
	`editorName` text DEFAULT '' NOT NULL,
	`workMode` text,
	`createdAt` text DEFAULT '' NOT NULL,
	`replacesKey` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`actKey` text NOT NULL,
	`editedByKey` text NOT NULL,
	FOREIGN KEY (`mapFeatureKey`) REFERENCES `mapFeatureEntity`(`mapFeatureKey`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mapKey`) REFERENCES `mapEntity`(`mapKey`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`linkedBlockKey`) REFERENCES `blockEntity`(`blockKey`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`editedByKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "mapFeatureTable_workMode" CHECK("mapFeatureTable"."workMode" IS NULL OR "mapFeatureTable"."workMode" IN ('planting', 'fruit', 'cones', 'seeds', 'shrooms')),
	CONSTRAINT "mapFeatureTable_geometryJson_bare" CHECK("mapFeatureTable"."geometryJson" IS NULL OR (json_valid("mapFeatureTable"."geometryJson")
			  AND json_extract("mapFeatureTable"."geometryJson", '$.type') IN ('Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon')
			  AND json_type("mapFeatureTable"."geometryJson", '$.properties') IS NULL)),
	CONSTRAINT "mapFeatureTable_featureOrigin" CHECK("mapFeatureTable"."featureOrigin" IN ('drawn', 'imported')),
	CONSTRAINT "mapFeatureTable_linkedBlockKey_on_a_pin" CHECK("mapFeatureTable"."linkedBlockKey" IS NULL OR json_extract("mapFeatureTable"."geometryJson", '$.type') = 'Point'),
	CONSTRAINT "mapFeatureTable_fillOpacity" CHECK("mapFeatureTable"."fillOpacity" IS NULL OR ("mapFeatureTable"."fillOpacity" >= 0 AND "mapFeatureTable"."fillOpacity" <= 1))
);
--> statement-breakpoint
CREATE INDEX `mapFeatureTable_key_idx` ON `mapFeatureTable` (`mapFeatureKey`);--> statement-breakpoint
CREATE INDEX `mapFeatureTable_parent_idx` ON `mapFeatureTable` (`replacesKey`,`mapFeatureKey`);--> statement-breakpoint
CREATE TABLE `mapTable` (
	`versionKey` text PRIMARY KEY NOT NULL,
	`mapKey` text NOT NULL,
	`mapName` text DEFAULT '' NOT NULL,
	`createdAt` text DEFAULT '' NOT NULL,
	`replacesKey` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`actKey` text NOT NULL,
	`editedByKey` text NOT NULL,
	FOREIGN KEY (`mapKey`) REFERENCES `mapEntity`(`mapKey`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`editedByKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `mapTable_key_idx` ON `mapTable` (`mapKey`);--> statement-breakpoint
CREATE INDEX `mapTable_parent_idx` ON `mapTable` (`replacesKey`,`mapKey`);--> statement-breakpoint
CREATE TABLE `orgKindTable` (
	`versionKey` text PRIMARY KEY NOT NULL,
	`orgKey` text NOT NULL,
	`orgKind` text NOT NULL,
	`createdAt` text DEFAULT '' NOT NULL,
	`replacesKey` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`actKey` text NOT NULL,
	FOREIGN KEY (`orgKey`) REFERENCES `orgTable`(`orgKey`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "orgKindTable_orgKind" CHECK("orgKindTable"."orgKind" IN ('plantingCompany', 'consultant', 'mill', 'nursery', 'government', 'ngo', 'contractor'))
);
--> statement-breakpoint
CREATE INDEX `orgKindTable_key_idx` ON `orgKindTable` (`orgKey`);--> statement-breakpoint
CREATE INDEX `orgKindTable_replaces_idx` ON `orgKindTable` (`replacesKey`);--> statement-breakpoint
CREATE TABLE `orgNameTable` (
	`versionKey` text PRIMARY KEY NOT NULL,
	`orgKey` text NOT NULL,
	`orgName` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '' NOT NULL,
	`createdAt` text DEFAULT '' NOT NULL,
	`replacesKey` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`actKey` text NOT NULL,
	FOREIGN KEY (`orgKey`) REFERENCES `orgTable`(`orgKey`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `orgNameTable_key_idx` ON `orgNameTable` (`orgKey`);--> statement-breakpoint
CREATE INDEX `orgNameTable_replaces_idx` ON `orgNameTable` (`replacesKey`);--> statement-breakpoint
CREATE TABLE `orgTable` (
	`orgKey` text PRIMARY KEY NOT NULL,
	`createdAt` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orgTagTable` (
	`versionKey` text PRIMARY KEY NOT NULL,
	`orgKey` text NOT NULL,
	`mapKey` text,
	`blockKey` text,
	`createdAt` text DEFAULT '' NOT NULL,
	`replacesKey` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`actKey` text NOT NULL,
	FOREIGN KEY (`orgKey`) REFERENCES `orgTable`(`orgKey`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mapKey`) REFERENCES `mapEntity`(`mapKey`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`blockKey`) REFERENCES `blockEntity`(`blockKey`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "orgTagTable_oneOwner" CHECK(("orgTagTable"."mapKey" IS NULL) <> ("orgTagTable"."blockKey" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `orgTagTable_map_idx` ON `orgTagTable` (`mapKey`);--> statement-breakpoint
CREATE INDEX `orgTagTable_replaces_idx` ON `orgTagTable` (`replacesKey`);--> statement-breakpoint
CREATE INDEX `orgTagTable_block_idx` ON `orgTagTable` (`blockKey`);--> statement-breakpoint
CREATE TABLE `packageEntity` (
	`packageKey` text PRIMARY KEY NOT NULL,
	`createdAt` text NOT NULL,
	`createdByKey` text NOT NULL,
	FOREIGN KEY (`createdByKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `packageTable` (
	`versionKey` text PRIMARY KEY NOT NULL,
	`packageKey` text NOT NULL,
	`fileName` text DEFAULT '' NOT NULL,
	`direction` text NOT NULL,
	`packageType` text NOT NULL,
	`plantedDt` text DEFAULT '' NOT NULL,
	`sentAt` text DEFAULT '' NOT NULL,
	`receivedAt` text DEFAULT '' NOT NULL,
	`rawJson` text DEFAULT '' NOT NULL,
	`byteSize` integer DEFAULT 0 NOT NULL,
	`logLine` text DEFAULT '' NOT NULL,
	`countsJson` text DEFAULT '' NOT NULL,
	`sentVersionKeysJson` text DEFAULT '' NOT NULL,
	`senderHighWaterAt` text DEFAULT '' NOT NULL,
	`shareLinkId` text DEFAULT '' NOT NULL,
	`shareDeleteToken` text DEFAULT '' NOT NULL,
	`shareAccess` text DEFAULT '' NOT NULL,
	`createdAt` text DEFAULT '' NOT NULL,
	`replacesKey` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`actKey` text NOT NULL,
	`editedByKey` text NOT NULL,
	FOREIGN KEY (`packageKey`) REFERENCES `packageEntity`(`packageKey`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`editedByKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "packageTable_direction" CHECK("packageTable"."direction" IN ('in', 'out')),
	CONSTRAINT "packageTable_packageType" CHECK("packageTable"."packageType" IN ('map', 'feat', 'tally', 'cache', 'qc', 'backup', 'block', 'refused', 'request', 'report')),
	CONSTRAINT "packageTable_in_received" CHECK("packageTable"."direction" = 'out' OR "packageTable"."receivedAt" <> ''),
	CONSTRAINT "packageTable_out_bare" CHECK("packageTable"."direction" = 'in' OR "packageTable"."rawJson" = ''),
	CONSTRAINT "packageTable_shareAccess" CHECK("packageTable"."shareAccess" IN ('', 'follow', 'join'))
);
--> statement-breakpoint
CREATE INDEX `packageTable_key_idx` ON `packageTable` (`packageKey`);--> statement-breakpoint
CREATE INDEX `packageTable_replaces_idx` ON `packageTable` (`replacesKey`);--> statement-breakpoint
CREATE TABLE `personEntity` (
	`personKey` text PRIMARY KEY NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `personIdTable` (
	`personId` text NOT NULL,
	`personKey` text NOT NULL,
	`createdAt` text DEFAULT '' NOT NULL,
	PRIMARY KEY(`personId`, `personKey`),
	FOREIGN KEY (`personKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `personIdTable_person_idx` ON `personIdTable` (`personKey`);--> statement-breakpoint
CREATE TABLE `personTable` (
	`versionKey` text PRIMARY KEY NOT NULL,
	`personKey` text NOT NULL,
	`username` text DEFAULT '' NOT NULL,
	`alias` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '' NOT NULL,
	`colorPickedAt` text DEFAULT '' NOT NULL,
	`sameAsKey` text,
	`hiddenAt` text,
	`alwaysPreviewAt` text,
	`starredAt` text,
	`createdAt` text DEFAULT '' NOT NULL,
	`replacesKey` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`actKey` text NOT NULL,
	FOREIGN KEY (`personKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sameAsKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "personTable_alias" CHECK("personTable"."alias" = '' OR "personTable"."alias" <> "personTable"."username")
);
--> statement-breakpoint
CREATE INDEX `personTable_key_idx` ON `personTable` (`personKey`);--> statement-breakpoint
CREATE INDEX `personTable_replaces_idx` ON `personTable` (`replacesKey`);--> statement-breakpoint
CREATE INDEX `personTable_sameAs_idx` ON `personTable` (`sameAsKey`);--> statement-breakpoint
CREATE TABLE `purgatoryTable` (
	`reviewKey` text PRIMARY KEY NOT NULL,
	`versionKey` text NOT NULL,
	`heldKey` text,
	`tableName` text NOT NULL,
	`isLate` integer DEFAULT 0 NOT NULL,
	`isEdit` integer DEFAULT 0 NOT NULL,
	`isClockBehind` integer DEFAULT 0 NOT NULL,
	`decision` text DEFAULT '' NOT NULL,
	`packageKey` text NOT NULL,
	`decidedAt` text DEFAULT '' NOT NULL,
	`decidedByKey` text,
	`followsKey` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`packageKey`) REFERENCES `packageEntity`(`packageKey`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`decidedByKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "purgatoryTable_tableName" CHECK("purgatoryTable"."tableName" IN ('tallyTable', 'bagUpTable', 'qaPlotTable', 'mapFeatureTable')),
	CONSTRAINT "purgatoryTable_decision" CHECK("purgatoryTable"."decision" IN ('', 'accepted', 'rejected')),
	CONSTRAINT "purgatoryTable_decided" CHECK("purgatoryTable"."decision" = '' OR "purgatoryTable"."decidedAt" <> '')
);
--> statement-breakpoint
CREATE INDEX `purgatoryTable_version_idx` ON `purgatoryTable` (`versionKey`);--> statement-breakpoint
CREATE UNIQUE INDEX `purgatoryTable_follows_uq` ON `purgatoryTable` (`followsKey`) WHERE "purgatoryTable"."followsKey" <> '';--> statement-breakpoint
CREATE TABLE `qaPlotEntity` (
	`qaPlotKey` text PRIMARY KEY NOT NULL,
	`plotNo` integer DEFAULT 0 NOT NULL,
	`plotNoSent` integer,
	`qaSurveyKey` text NOT NULL,
	`createdAt` text NOT NULL,
	`createdByKey` text NOT NULL,
	FOREIGN KEY (`qaSurveyKey`) REFERENCES `qaSurveyEntity`(`qaSurveyKey`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`createdByKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `qaPlotEntity_plotNo_uq` ON `qaPlotEntity` (`qaSurveyKey`,`plotNo`) WHERE "qaPlotEntity"."plotNo" <> 0;--> statement-breakpoint
CREATE TABLE `qaPlotTable` (
	`versionKey` text PRIMARY KEY NOT NULL,
	`qaPlotKey` text NOT NULL,
	`plantedQty` real NOT NULL,
	`plantableSpotsQty` real,
	`plantableSpotsOverrideQty` real,
	`faultsJson` text DEFAULT '' NOT NULL,
	`splitPlantJson` text DEFAULT '' NOT NULL,
	`plotDesc` text DEFAULT '' NOT NULL,
	`isOccupied` integer DEFAULT 0 NOT NULL,
	`openLocode` text DEFAULT '' NOT NULL,
	`qaSurveyKey` text NOT NULL,
	`mapFeatureKey` text,
	`createdAt` text DEFAULT '' NOT NULL,
	`replacesKey` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`actKey` text NOT NULL,
	`editedByKey` text NOT NULL,
	FOREIGN KEY (`qaPlotKey`) REFERENCES `qaPlotEntity`(`qaPlotKey`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`qaSurveyKey`) REFERENCES `qaSurveyEntity`(`qaSurveyKey`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mapFeatureKey`) REFERENCES `mapFeatureEntity`(`mapFeatureKey`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`editedByKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `qaPlotTable_key_idx` ON `qaPlotTable` (`qaPlotKey`);--> statement-breakpoint
CREATE INDEX `qaPlotTable_parent_idx` ON `qaPlotTable` (`replacesKey`,`qaPlotKey`);--> statement-breakpoint
CREATE TABLE `qaSurveyEntity` (
	`qaSurveyKey` text PRIMARY KEY NOT NULL,
	`createdAt` text NOT NULL,
	`createdByKey` text NOT NULL,
	FOREIGN KEY (`createdByKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `qaSurveyTable` (
	`versionKey` text PRIMARY KEY NOT NULL,
	`qaSurveyKey` text NOT NULL,
	`surveyName` text DEFAULT '' NOT NULL,
	`areaHa` real,
	`treesPerHa` real,
	`speciesChoicesJson` text DEFAULT '' NOT NULL,
	`mapKey` text NOT NULL,
	`blockKey` text,
	`createdAt` text DEFAULT '' NOT NULL,
	`replacesKey` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`actKey` text NOT NULL,
	`editedByKey` text NOT NULL,
	FOREIGN KEY (`qaSurveyKey`) REFERENCES `qaSurveyEntity`(`qaSurveyKey`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mapKey`) REFERENCES `mapEntity`(`mapKey`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`blockKey`) REFERENCES `blockEntity`(`blockKey`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`editedByKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "qaSurveyTable_species_not_empty_list" CHECK("qaSurveyTable"."speciesChoicesJson" <> '[]')
);
--> statement-breakpoint
CREATE INDEX `qaSurveyTable_key_idx` ON `qaSurveyTable` (`qaSurveyKey`);--> statement-breakpoint
CREATE INDEX `qaSurveyTable_parent_idx` ON `qaSurveyTable` (`replacesKey`,`qaSurveyKey`);--> statement-breakpoint
CREATE TABLE `settingTable` (
	`settingKey` text NOT NULL,
	`workMode` text DEFAULT '' NOT NULL,
	`value` text NOT NULL,
	`updatedAt` text NOT NULL,
	PRIMARY KEY(`settingKey`, `workMode`),
	CONSTRAINT "settingTable_settingKey" CHECK("settingTable"."settingKey" IN ('mode', 'container', 'currency', 'distance', 'price', 'area', 'boxSize', 'bundleSize', 'measure', 'majorVessel', 'minorVessel', 'treesPerHa')),
	CONSTRAINT "settingTable_workMode" CHECK("settingTable"."workMode" = '' OR "settingTable"."workMode" IN ('planting', 'fruit', 'cones', 'seeds', 'shrooms')),
	CONSTRAINT "settingTable_mode_global" CHECK("settingTable"."settingKey" <> 'mode' OR "settingTable"."workMode" = '')
);
--> statement-breakpoint
CREATE TABLE `speciesMarkTable` (
	`versionKey` text PRIMARY KEY NOT NULL,
	`speciesKey` text NOT NULL,
	`isStarred` integer,
	`alias` text DEFAULT '' NOT NULL,
	`createdAt` text DEFAULT '' NOT NULL,
	`replacesKey` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`actKey` text NOT NULL,
	CONSTRAINT "speciesMarkTable_isStarred" CHECK("speciesMarkTable"."isStarred" IS NULL OR "speciesMarkTable"."isStarred" IN (0, 1))
);
--> statement-breakpoint
CREATE INDEX `speciesMarkTable_key_idx` ON `speciesMarkTable` (`speciesKey`);--> statement-breakpoint
CREATE INDEX `speciesMarkTable_replaces_idx` ON `speciesMarkTable` (`replacesKey`);--> statement-breakpoint
CREATE TABLE `speciesTable` (
	`versionKey` text PRIMARY KEY NOT NULL,
	`speciesKey` text NOT NULL,
	`commonName` text NOT NULL,
	`scientificName` text DEFAULT '' NOT NULL,
	`speciesGroup` text NOT NULL,
	`createdAt` text DEFAULT '' NOT NULL,
	`replacesKey` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`actKey` text NOT NULL,
	CONSTRAINT "speciesTable_speciesGroup" CHECK("speciesTable"."speciesGroup" IN ('tree', 'mushroom', 'fruit')),
	CONSTRAINT "speciesTable_commonName" CHECK(trim("speciesTable"."commonName") <> '')
);
--> statement-breakpoint
CREATE INDEX `speciesTable_key_idx` ON `speciesTable` (`speciesKey`);--> statement-breakpoint
CREATE INDEX `speciesTable_replaces_idx` ON `speciesTable` (`replacesKey`);--> statement-breakpoint
CREATE TABLE `stockTable` (
	`versionKey` text PRIMARY KEY NOT NULL,
	`mapFeatureKey` text NOT NULL,
	`cropKey` text NOT NULL,
	`workMode` text NOT NULL,
	`boxQty` real,
	`bundleQty` real,
	`treesQty` real,
	`createdAt` text DEFAULT '' NOT NULL,
	`replacesKey` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`actKey` text NOT NULL,
	`countedByKey` text NOT NULL,
	FOREIGN KEY (`mapFeatureKey`) REFERENCES `mapFeatureEntity`(`mapFeatureKey`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`countedByKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`cropKey`,`workMode`) REFERENCES `cropEntity`(`cropKey`,`workMode`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "stockTable_workMode" CHECK("stockTable"."workMode" IN ('planting', 'fruit', 'cones', 'seeds', 'shrooms')),
	CONSTRAINT "stockTable_boxQty" CHECK("stockTable"."boxQty" >= 0),
	CONSTRAINT "stockTable_bundleQty" CHECK("stockTable"."bundleQty" >= 0),
	CONSTRAINT "stockTable_treesQty" CHECK("stockTable"."treesQty" >= 0)
);
--> statement-breakpoint
CREATE INDEX `stockTable_key_idx` ON `stockTable` (`mapFeatureKey`,`cropKey`);--> statement-breakpoint
CREATE INDEX `stockTable_replaces_idx` ON `stockTable` (`replacesKey`);--> statement-breakpoint
CREATE TABLE `tallyEntity` (
	`tallyKey` text PRIMARY KEY NOT NULL,
	`createdAt` text NOT NULL,
	`createdByKey` text NOT NULL,
	FOREIGN KEY (`createdByKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `tallyTable` (
	`versionKey` text PRIMARY KEY NOT NULL,
	`tallyKey` text NOT NULL,
	`boxTag` text DEFAULT '' NOT NULL,
	`speciesKey` text DEFAULT '' NOT NULL,
	`plantedQty` real NOT NULL,
	`pricePerTree` real,
	`currency` text,
	`bagUpKey` text NOT NULL,
	`bagKey` text NOT NULL,
	`cropKey` text NOT NULL,
	`workMode` text NOT NULL,
	`createdAt` text DEFAULT '' NOT NULL,
	`replacesKey` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`actKey` text NOT NULL,
	`editedByKey` text NOT NULL,
	FOREIGN KEY (`tallyKey`) REFERENCES `tallyEntity`(`tallyKey`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`editedByKey`) REFERENCES `personEntity`(`personKey`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`bagUpKey`,`workMode`) REFERENCES `bagUpEntity`(`bagUpKey`,`workMode`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bagKey`,`workMode`) REFERENCES `bagEntity`(`bagKey`,`workMode`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cropKey`,`workMode`) REFERENCES `cropEntity`(`cropKey`,`workMode`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "tallyTable_workMode" CHECK("tallyTable"."workMode" IN ('planting', 'fruit', 'cones', 'seeds', 'shrooms')),
	CONSTRAINT "tallyTable_plantedQty" CHECK("tallyTable"."plantedQty" <> 0),
	CONSTRAINT "tallyTable_currency" CHECK(("tallyTable"."currency" IS NOT NULL AND "tallyTable"."currency" GLOB '[A-Z][A-Z][A-Z]') OR ("tallyTable"."currency" IS NULL AND "tallyTable"."pricePerTree" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `tallyTable_key_idx` ON `tallyTable` (`tallyKey`);--> statement-breakpoint
CREATE INDEX `tallyTable_parent_idx` ON `tallyTable` (`replacesKey`,`tallyKey`);--> statement-breakpoint
CREATE TABLE `touchTable` (
	`entityKey` text PRIMARY KEY NOT NULL,
	`lastTouchedAt` text DEFAULT '' NOT NULL,
	`sortAt` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `userProfile` (
	`userProfileId` text PRIMARY KEY NOT NULL,
	`displayName` text,
	`email` text,
	`orgKey` text,
	`authId` text DEFAULT '' NOT NULL,
	`personId` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`orgKey`) REFERENCES `orgTable`(`orgKey`) ON UPDATE no action ON DELETE set null
);

CREATE TABLE IF NOT EXISTS mapView AS SELECT v.versionKey, v.mapKey, v.mapName, e.createdAt, v.replacesKey, v.kind, v.actKey, v.editedByKey, e.createdByKey FROM mapTable v JOIN mapEntity e USING (mapKey) WHERE false;
CREATE INDEX mapView_thing_idx ON mapView (mapKey);
CREATE TABLE IF NOT EXISTS mapFeatureView AS SELECT v.versionKey, v.mapFeatureKey, v.featureName, v.featureType, v.geometryJson, v.featureDesc, v.featureDataJson, v.pinIcon, v.fillOpacity, v.isTitleShown, v.overlayJson, v.featureOrigin, v.mapKey, v.linkedBlockKey, v.mergedFromJson, v.editorName, v.workMode, e.createdAt, v.replacesKey, v.kind, v.actKey, v.editedByKey, e.createdByKey FROM mapFeatureTable v JOIN mapFeatureEntity e USING (mapFeatureKey) WHERE false;
CREATE INDEX mapFeatureView_thing_idx ON mapFeatureView (mapFeatureKey);
CREATE TABLE IF NOT EXISTS qaSurveyView AS SELECT v.versionKey, v.qaSurveyKey, v.surveyName, v.areaHa, v.treesPerHa, v.speciesChoicesJson, v.mapKey, v.blockKey, e.createdAt, v.replacesKey, v.kind, v.actKey, v.editedByKey, e.createdByKey FROM qaSurveyTable v JOIN qaSurveyEntity e USING (qaSurveyKey) WHERE false;
CREATE INDEX qaSurveyView_thing_idx ON qaSurveyView (qaSurveyKey);
CREATE TABLE IF NOT EXISTS qaPlotView AS SELECT v.versionKey, v.qaPlotKey, v.plantedQty, v.plantableSpotsQty, v.plantableSpotsOverrideQty, v.faultsJson, v.splitPlantJson, v.plotDesc, v.isOccupied, v.openLocode, v.qaSurveyKey, v.mapFeatureKey, e.createdAt, v.replacesKey, v.kind, v.actKey, v.editedByKey, e.createdByKey FROM qaPlotTable v JOIN qaPlotEntity e USING (qaPlotKey) WHERE false;
CREATE INDEX qaPlotView_thing_idx ON qaPlotView (qaPlotKey);
CREATE TABLE IF NOT EXISTS blockView AS SELECT v.versionKey, v.blockKey, v.blockName, v.treesPerHa, v.mapFeatureKey, e.createdAt, v.replacesKey, v.kind, v.actKey, v.editedByKey, e.createdByKey FROM blockTable v JOIN blockEntity e USING (blockKey) WHERE false;
CREATE INDEX blockView_thing_idx ON blockView (blockKey);
CREATE TABLE IF NOT EXISTS cropView AS SELECT v.versionKey, v.cropKey, v.workMode, v.boxTag, v.speciesKey, v.container, v.boxSizeQty, v.bundleSizeQty, e.createdAt, v.replacesKey, v.kind, v.actKey, v.editedByKey, e.createdByKey FROM cropTable v JOIN cropEntity e USING (cropKey) WHERE false;
CREATE INDEX cropView_thing_idx ON cropView (cropKey);
CREATE TABLE IF NOT EXISTS bagView AS SELECT v.versionKey, v.bagKey, v.boxQty, v.bundleQty, v.pricePerTree, v.currency, v.isBox, v.isBagged, v.bundlesInBags, v.bundlesOnGround, v.halfBoxParity, v.sortOrder, v.cropKey, v.workMode, e.createdAt, v.replacesKey, v.kind, v.actKey, v.editedByKey, e.createdByKey FROM bagTable v JOIN bagEntity e USING (bagKey) WHERE false;
CREATE INDEX bagView_thing_idx ON bagView (bagKey);
CREATE TABLE IF NOT EXISTS bagUpView AS SELECT v.versionKey, v.bagUpKey, v.plantedDt, v.workMode, v.blockKey, v.mapFeatureKey, e.createdAt, v.replacesKey, v.kind, v.actKey, v.editedByKey, e.createdByKey FROM bagUpTable v JOIN bagUpEntity e USING (bagUpKey) WHERE false;
CREATE INDEX bagUpView_thing_idx ON bagUpView (bagUpKey);
CREATE TABLE IF NOT EXISTS tallyView AS SELECT v.versionKey, v.tallyKey, v.boxTag, v.speciesKey, v.plantedQty, v.pricePerTree, v.currency, v.bagUpKey, v.bagKey, v.cropKey, v.workMode, e.createdAt, v.replacesKey, v.kind, v.actKey, v.editedByKey, e.createdByKey FROM tallyTable v JOIN tallyEntity e USING (tallyKey) WHERE false;
CREATE INDEX tallyView_thing_idx ON tallyView (tallyKey);
CREATE TABLE IF NOT EXISTS packageView AS SELECT v.versionKey, v.packageKey, v.fileName, v.direction, v.packageType, v.plantedDt, v.sentAt, v.receivedAt, v.rawJson, v.byteSize, v.logLine, v.countsJson, v.sentVersionKeysJson, v.senderHighWaterAt, v.shareLinkId, v.shareDeleteToken, v.shareAccess, e.createdAt, v.replacesKey, v.kind, v.actKey, v.editedByKey, e.createdByKey FROM packageTable v JOIN packageEntity e USING (packageKey) WHERE false;
CREATE INDEX packageView_thing_idx ON packageView (packageKey);
CREATE TABLE IF NOT EXISTS personView AS SELECT v.versionKey, v.personKey, v.username, v.alias, v.color, v.colorPickedAt, v.sameAsKey, v.hiddenAt, v.alwaysPreviewAt, v.starredAt, e.createdAt, v.replacesKey, v.kind, v.actKey FROM personTable v JOIN personEntity e USING (personKey) WHERE false;
CREATE INDEX personView_thing_idx ON personView (personKey);
CREATE TABLE IF NOT EXISTS crewView AS SELECT * FROM crewTable WHERE false;
CREATE INDEX crewView_thing_idx ON crewView (versionKey);
CREATE TABLE IF NOT EXISTS orgKindView AS SELECT * FROM orgKindTable WHERE false;
CREATE INDEX orgKindView_thing_idx ON orgKindView (versionKey);
CREATE TABLE IF NOT EXISTS orgTagView AS SELECT * FROM orgTagTable WHERE false;
CREATE INDEX orgTagView_thing_idx ON orgTagView (versionKey);
CREATE TABLE IF NOT EXISTS orgNameView AS SELECT * FROM orgNameTable WHERE false;
CREATE INDEX orgNameView_thing_idx ON orgNameView (orgKey);
CREATE TABLE IF NOT EXISTS stockView AS SELECT * FROM stockTable WHERE false;
CREATE INDEX stockView_thing_idx ON stockView (mapFeatureKey, cropKey);
CREATE TABLE IF NOT EXISTS deliveryView AS SELECT * FROM deliveryTable WHERE false;
CREATE INDEX deliveryView_thing_idx ON deliveryView (mapFeatureKey, cropKey);
CREATE TABLE IF NOT EXISTS allocationView AS SELECT * FROM allocationTable WHERE false;
CREATE INDEX allocationView_thing_idx ON allocationView (blockKey, workMode);
CREATE TABLE IF NOT EXISTS speciesView AS SELECT * FROM speciesTable WHERE false;
CREATE INDEX speciesView_thing_idx ON speciesView (speciesKey);
CREATE TABLE IF NOT EXISTS speciesMarkView AS SELECT * FROM speciesMarkTable WHERE false;
CREATE INDEX speciesMarkView_thing_idx ON speciesMarkView (speciesKey);
CREATE VIEW tallyFlagView AS SELECT * FROM (WITH line AS (SELECT t.*, b.plantedDt, b.createdByKey AS personKey, COALESCE(t.currency, '') || '/' || t.speciesKey AS unit, b.plantedDt AS day,
	        t.plantedQty * t.pricePerTree AS total,
	        SUM(t.plantedQty * t.pricePerTree) OVER (PARTITION BY b.createdByKey, b.plantedDt, t.currency) AS dayTotal,
	        ROW_NUMBER() OVER (PARTITION BY b.createdByKey, b.plantedDt, t.currency ORDER BY t.actAt DESC, t.actKey DESC, t.versionKey DESC) AS fromLast
	   FROM (SELECT *, MIN(createdAt) OVER (PARTITION BY actKey) AS actAt FROM tallyView) t JOIN bagUpView b USING (bagUpKey)),
		days AS (SELECT DISTINCT personKey, unit, day FROM line),
		sample AS (
		  SELECT d.personKey, d.unit, d.day, w.pricePerTree AS pricePerTree, w.plantedQty AS plantedQty, w.total AS total
		    FROM days d JOIN line w ON w.personKey = d.personKey AND w.unit = d.unit AND w.day BETWEEN date(d.day, '-30 days') AND d.day),
		ranked AS (
		  SELECT *, COUNT(pricePerTree) OVER (PARTITION BY personKey, unit, day) AS nPrice, ROW_NUMBER() OVER (PARTITION BY personKey, unit, day ORDER BY pricePerTree DESC) AS rPrice, COUNT(plantedQty) OVER (PARTITION BY personKey, unit, day) AS nTrees, ROW_NUMBER() OVER (PARTITION BY personKey, unit, day ORDER BY plantedQty DESC) AS rTrees, COUNT(total) OVER (PARTITION BY personKey, unit, day) AS nTotal, ROW_NUMBER() OVER (PARTITION BY personKey, unit, day ORDER BY total DESC) AS rTotal
		    FROM sample),
		med AS (
		  SELECT personKey, unit, day, MAX(nPrice) AS nPrice, AVG(CASE WHEN rPrice IN ((nPrice + 1) / 2, (nPrice + 2) / 2) THEN pricePerTree END) AS normPrice, MAX(nTrees) AS nTrees, AVG(CASE WHEN rTrees IN ((nTrees + 1) / 2, (nTrees + 2) / 2) THEN plantedQty END) AS normTrees, MAX(nTotal) AS nTotal, AVG(CASE WHEN rTotal IN ((nTotal + 1) / 2, (nTotal + 2) / 2) THEN total END) AS normTotal
		    FROM ranked GROUP BY personKey, unit, day),
		spread AS (
		  SELECT s.personKey, s.unit, s.day,
		         abs(s.pricePerTree - m.normPrice) AS dPrice, ROW_NUMBER() OVER (PARTITION BY s.personKey, s.unit, s.day ORDER BY abs(s.pricePerTree - m.normPrice) DESC) AS rPrice, abs(s.plantedQty - m.normTrees) AS dTrees, ROW_NUMBER() OVER (PARTITION BY s.personKey, s.unit, s.day ORDER BY abs(s.plantedQty - m.normTrees) DESC) AS rTrees, abs(s.total - m.normTotal) AS dTotal, ROW_NUMBER() OVER (PARTITION BY s.personKey, s.unit, s.day ORDER BY abs(s.total - m.normTotal) DESC) AS rTotal
		    FROM sample s JOIN med m USING (personKey, unit, day)),
		norm AS (
		  SELECT m.*, AVG(CASE WHEN s.rPrice IN ((m.nPrice + 1) / 2, (m.nPrice + 2) / 2) THEN s.dPrice END) AS madPrice, AVG(CASE WHEN s.rTrees IN ((m.nTrees + 1) / 2, (m.nTrees + 2) / 2) THEN s.dTrees END) AS madTrees, AVG(CASE WHEN s.rTotal IN ((m.nTotal + 1) / 2, (m.nTotal + 2) / 2) THEN s.dTotal END) AS madTotal
		    FROM med m JOIN spread s USING (personKey, unit, day) GROUP BY m.personKey, m.unit, m.day)
		SELECT l.*, n.normPrice, n.madPrice, n.nPrice, n.normTrees, n.madTrees, n.nTrees, n.normTotal, n.madTotal, n.nTotal,
		       TRIM(CASE WHEN n.nPrice >= 5 AND n.madPrice > 0 AND abs(0.6745 * (l.pricePerTree - n.normPrice) / n.madPrice) > 3.5 THEN 'price ' || rtrim(rtrim(printf('%.2f', l.pricePerTree), '0'), '.') || ' vs usual ' || rtrim(rtrim(printf('%.2f', n.normPrice), '0'), '.') || '; ' ELSE '' END || CASE WHEN n.nTrees >= 5 AND n.madTrees > 0 AND abs(0.6745 * (l.plantedQty - n.normTrees) / n.madTrees) > 3.5 THEN 'trees ' || rtrim(rtrim(printf('%.2f', l.plantedQty), '0'), '.') || ' vs usual ' || rtrim(rtrim(printf('%.2f', n.normTrees), '0'), '.') || '; ' ELSE '' END || CASE WHEN n.nTotal >= 5 AND n.madTotal > 0 AND abs(0.6745 * (l.total - n.normTotal) / n.madTotal) > 3.5 THEN 'total ' || rtrim(rtrim(printf('%.2f', l.total), '0'), '.') || ' vs usual ' || rtrim(rtrim(printf('%.2f', n.normTotal), '0'), '.') || '; ' ELSE '' END || CASE WHEN l.fromLast = 1 AND l.dayTotal > CASE l.currency WHEN 'CAD' THEN 1000 WHEN 'USD' THEN 1000 WHEN 'EUR' THEN 900 WHEN 'GBP' THEN 800 WHEN 'CHF' THEN 800 WHEN 'AUD' THEN 2000 WHEN 'NZD' THEN 2000 WHEN 'SGD' THEN 1000 WHEN 'BTC' THEN 0.01 WHEN 'AZN' THEN 2000 WHEN 'GEL' THEN 3000 WHEN 'AED' THEN 4000 WHEN 'SAR' THEN 4000 WHEN 'ILS' THEN 4000 WHEN 'PEN' THEN 4000 WHEN 'PLN' THEN 4000 WHEN 'MYR' THEN 4000 WHEN 'RON' THEN 5000 WHEN 'BRL' THEN 6000 WHEN 'DKK' THEN 7000 WHEN 'CNY' THEN 7000 WHEN 'HKD' THEN 8000 WHEN 'SEK' THEN 10000 WHEN 'NOK' THEN 10000 WHEN 'GHS' THEN 10000 WHEN 'ZAR' THEN 20000 WHEN 'MXN' THEN 20000 WHEN 'CZK' THEN 20000 WHEN 'TWD' THEN 30000 WHEN 'THB' THEN 30000 WHEN 'TRY' THEN 40000 WHEN 'UAH' THEN 40000 WHEN 'MKD' THEN 60000 WHEN 'PHP' THEN 60000 WHEN 'AFN' THEN 70000 WHEN 'RUB' THEN 90000 WHEN 'KGS' THEN 90000 WHEN 'INR' THEN 90000 WHEN 'BDT' THEN 100000 WHEN 'ISK' THEN 100000 WHEN 'KES' THEN 100000 WHEN 'JPY' THEN 200000 WHEN 'HUF' THEN 400000 WHEN 'AMD' THEN 400000 WHEN 'CRC' THEN 500000 WHEN 'KZT' THEN 500000 WHEN 'CLP' THEN 1000000 WHEN 'KRW' THEN 1000000 WHEN 'ARS' THEN 1000000 WHEN 'NGN' THEN 2000000 WHEN 'MNT' THEN 4000000 WHEN 'KHR' THEN 4000000 WHEN 'COP' THEN 4000000 WHEN 'PYG' THEN 8000000 WHEN 'IDR' THEN 20000000 WHEN 'LAK' THEN 20000000 WHEN 'VND' THEN 30000000 WHEN 'IRR' THEN 1000000000 END THEN 'day ' || rtrim(rtrim(printf('%.2f', l.dayTotal), '0'), '.') || ' over ' || rtrim(rtrim(printf('%.2f', CASE l.currency WHEN 'CAD' THEN 1000 WHEN 'USD' THEN 1000 WHEN 'EUR' THEN 900 WHEN 'GBP' THEN 800 WHEN 'CHF' THEN 800 WHEN 'AUD' THEN 2000 WHEN 'NZD' THEN 2000 WHEN 'SGD' THEN 1000 WHEN 'BTC' THEN 0.01 WHEN 'AZN' THEN 2000 WHEN 'GEL' THEN 3000 WHEN 'AED' THEN 4000 WHEN 'SAR' THEN 4000 WHEN 'ILS' THEN 4000 WHEN 'PEN' THEN 4000 WHEN 'PLN' THEN 4000 WHEN 'MYR' THEN 4000 WHEN 'RON' THEN 5000 WHEN 'BRL' THEN 6000 WHEN 'DKK' THEN 7000 WHEN 'CNY' THEN 7000 WHEN 'HKD' THEN 8000 WHEN 'SEK' THEN 10000 WHEN 'NOK' THEN 10000 WHEN 'GHS' THEN 10000 WHEN 'ZAR' THEN 20000 WHEN 'MXN' THEN 20000 WHEN 'CZK' THEN 20000 WHEN 'TWD' THEN 30000 WHEN 'THB' THEN 30000 WHEN 'TRY' THEN 40000 WHEN 'UAH' THEN 40000 WHEN 'MKD' THEN 60000 WHEN 'PHP' THEN 60000 WHEN 'AFN' THEN 70000 WHEN 'RUB' THEN 90000 WHEN 'KGS' THEN 90000 WHEN 'INR' THEN 90000 WHEN 'BDT' THEN 100000 WHEN 'ISK' THEN 100000 WHEN 'KES' THEN 100000 WHEN 'JPY' THEN 200000 WHEN 'HUF' THEN 400000 WHEN 'AMD' THEN 400000 WHEN 'CRC' THEN 500000 WHEN 'KZT' THEN 500000 WHEN 'CLP' THEN 1000000 WHEN 'KRW' THEN 1000000 WHEN 'ARS' THEN 1000000 WHEN 'NGN' THEN 2000000 WHEN 'MNT' THEN 4000000 WHEN 'KHR' THEN 4000000 WHEN 'COP' THEN 4000000 WHEN 'PYG' THEN 8000000 WHEN 'IDR' THEN 20000000 WHEN 'LAK' THEN 20000000 WHEN 'VND' THEN 30000000 WHEN 'IRR' THEN 1000000000 END), '0'), '.') ELSE '' END, '; ') AS flag
		  FROM line l LEFT JOIN norm n ON n.personKey = l.personKey AND n.unit = l.unit AND n.day = l.day);
CREATE VIEW bagUpFlagView AS SELECT * FROM (WITH line AS (SELECT b.bagUpKey, b.createdByKey AS personKey, b.workMode AS unit, b.plantedDt AS day, SUM(t.plantedQty) AS treesQty
	   FROM bagUpView b JOIN tallyView t USING (bagUpKey) GROUP BY b.bagUpKey),
		days AS (SELECT DISTINCT personKey, unit, day FROM line),
		sample AS (
		  SELECT d.personKey, d.unit, d.day, w.treesQty AS treesQty
		    FROM days d JOIN line w ON w.personKey = d.personKey AND w.unit = d.unit AND w.day BETWEEN date(d.day, '-30 days') AND d.day),
		ranked AS (
		  SELECT *, COUNT(treesQty) OVER (PARTITION BY personKey, unit, day) AS nTrees, ROW_NUMBER() OVER (PARTITION BY personKey, unit, day ORDER BY treesQty DESC) AS rTrees
		    FROM sample),
		med AS (
		  SELECT personKey, unit, day, MAX(nTrees) AS nTrees, AVG(CASE WHEN rTrees IN ((nTrees + 1) / 2, (nTrees + 2) / 2) THEN treesQty END) AS normTrees
		    FROM ranked GROUP BY personKey, unit, day),
		spread AS (
		  SELECT s.personKey, s.unit, s.day,
		         abs(s.treesQty - m.normTrees) AS dTrees, ROW_NUMBER() OVER (PARTITION BY s.personKey, s.unit, s.day ORDER BY abs(s.treesQty - m.normTrees) DESC) AS rTrees
		    FROM sample s JOIN med m USING (personKey, unit, day)),
		norm AS (
		  SELECT m.*, AVG(CASE WHEN s.rTrees IN ((m.nTrees + 1) / 2, (m.nTrees + 2) / 2) THEN s.dTrees END) AS madTrees
		    FROM med m JOIN spread s USING (personKey, unit, day) GROUP BY m.personKey, m.unit, m.day)
		SELECT l.*, n.normTrees, n.madTrees, n.nTrees,
		       TRIM(CASE WHEN n.nTrees >= 5 AND n.madTrees > 0 AND abs(0.6745 * (l.treesQty - n.normTrees) / n.madTrees) > 3.5 THEN 'trees ' || rtrim(rtrim(printf('%.2f', l.treesQty), '0'), '.') || ' vs usual ' || rtrim(rtrim(printf('%.2f', n.normTrees), '0'), '.') || '; ' ELSE '' END || '', '; ') AS flag
		  FROM line l LEFT JOIN norm n ON n.personKey = l.personKey AND n.unit = l.unit AND n.day = l.day);
CREATE VIEW boxFlagView AS SELECT * FROM (WITH line AS (
	   SELECT cropKey, container, boxSizeQty, bundleSizeQty, editedByKey AS personKey
	     FROM cropView WHERE boxSizeQty IS NOT NULL OR bundleSizeQty IS NOT NULL),
	 kind AS (
	   SELECT personKey, container, SUM(boxSizeQty) AS sumBox, COUNT(boxSizeQty) AS nBox, SUM(bundleSizeQty) AS sumBundle, COUNT(bundleSizeQty) AS nBundle
	     FROM line WHERE container IS NOT NULL GROUP BY personKey, container),
	 usual AS (
	   SELECT l.*, (k.sumBox - COALESCE(l.boxSizeQty, 0)) / NULLIF(k.nBox - (l.boxSizeQty IS NOT NULL), 0) AS usualBox, (k.sumBundle - COALESCE(l.bundleSizeQty, 0)) / NULLIF(k.nBundle - (l.bundleSizeQty IS NOT NULL), 0) AS usualBundle
	     FROM line l LEFT JOIN kind k USING (personKey, container))
	 SELECT u.*, CASE WHEN u.container IS NULL OR u.container = 'singles' THEN '' ELSE COALESCE(CASE WHEN u.boxSizeQty >= 3 * u.usualBox OR 3 * u.boxSizeQty <= u.usualBox THEN u.container || ' size ' || CAST(u.boxSizeQty AS INTEGER) || ' vs usual ' || CAST(ROUND(u.usualBox) AS INTEGER) END, CASE WHEN u.bundleSizeQty >= 3 * u.usualBundle OR 3 * u.bundleSizeQty <= u.usualBundle THEN 'bundle' || ' size ' || CAST(u.bundleSizeQty AS INTEGER) || ' vs usual ' || CAST(ROUND(u.usualBundle) AS INTEGER) END, '') END AS flag
	   FROM usual u);
CREATE VIEW qaPlotFlagView AS SELECT * FROM (WITH line AS (SELECT v.qaPlotKey, v.plantedQty, v.editedByKey AS personKey, '' AS unit, date(x.createdAt) AS day
	   FROM qaPlotView v JOIN qaPlotTable x USING (versionKey) WHERE v.plantedQty >= 0),
		days AS (SELECT DISTINCT personKey, unit, day FROM line),
		sample AS (
		  SELECT d.personKey, d.unit, d.day, w.plantedQty AS plantedQty
		    FROM days d JOIN line w ON w.personKey = d.personKey AND w.unit = d.unit AND w.day BETWEEN date(d.day, '-30 days') AND d.day),
		ranked AS (
		  SELECT *, COUNT(plantedQty) OVER (PARTITION BY personKey, unit, day) AS nPlanted, ROW_NUMBER() OVER (PARTITION BY personKey, unit, day ORDER BY plantedQty DESC) AS rPlanted
		    FROM sample),
		med AS (
		  SELECT personKey, unit, day, MAX(nPlanted) AS nPlanted, AVG(CASE WHEN rPlanted IN ((nPlanted + 1) / 2, (nPlanted + 2) / 2) THEN plantedQty END) AS normPlanted
		    FROM ranked GROUP BY personKey, unit, day),
		spread AS (
		  SELECT s.personKey, s.unit, s.day,
		         abs(s.plantedQty - m.normPlanted) AS dPlanted, ROW_NUMBER() OVER (PARTITION BY s.personKey, s.unit, s.day ORDER BY abs(s.plantedQty - m.normPlanted) DESC) AS rPlanted
		    FROM sample s JOIN med m USING (personKey, unit, day)),
		norm AS (
		  SELECT m.*, AVG(CASE WHEN s.rPlanted IN ((m.nPlanted + 1) / 2, (m.nPlanted + 2) / 2) THEN s.dPlanted END) AS madPlanted
		    FROM med m JOIN spread s USING (personKey, unit, day) GROUP BY m.personKey, m.unit, m.day)
		SELECT l.*, n.normPlanted, n.madPlanted, n.nPlanted,
		       TRIM(CASE WHEN n.nPlanted >= 5 AND n.madPlanted > 0 AND abs(0.6745 * (l.plantedQty - n.normPlanted) / n.madPlanted) > 3.5 THEN 'plot ' || rtrim(rtrim(printf('%.2f', l.plantedQty), '0'), '.') || ' vs usual ' || rtrim(rtrim(printf('%.2f', n.normPlanted), '0'), '.') || '; ' ELSE '' END || '', '; ') AS flag
		  FROM line l LEFT JOIN norm n ON n.personKey = l.personKey AND n.unit = l.unit AND n.day = l.day);
CREATE VIEW blockFlagView AS SELECT * FROM (WITH line AS (SELECT v.blockKey, v.treesPerHa, v.editedByKey AS personKey, '' AS unit, date(x.createdAt) AS day
	   FROM blockView v JOIN blockTable x USING (versionKey) WHERE v.treesPerHa IS NOT NULL),
		days AS (SELECT DISTINCT personKey, unit, day FROM line),
		sample AS (
		  SELECT d.personKey, d.unit, d.day, w.treesPerHa AS treesPerHa
		    FROM days d JOIN line w ON w.personKey = d.personKey AND w.unit = d.unit AND w.day BETWEEN date(d.day, '-30 days') AND d.day),
		ranked AS (
		  SELECT *, COUNT(treesPerHa) OVER (PARTITION BY personKey, unit, day) AS nRate, ROW_NUMBER() OVER (PARTITION BY personKey, unit, day ORDER BY treesPerHa DESC) AS rRate
		    FROM sample),
		med AS (
		  SELECT personKey, unit, day, MAX(nRate) AS nRate, AVG(CASE WHEN rRate IN ((nRate + 1) / 2, (nRate + 2) / 2) THEN treesPerHa END) AS normRate
		    FROM ranked GROUP BY personKey, unit, day),
		spread AS (
		  SELECT s.personKey, s.unit, s.day,
		         abs(s.treesPerHa - m.normRate) AS dRate, ROW_NUMBER() OVER (PARTITION BY s.personKey, s.unit, s.day ORDER BY abs(s.treesPerHa - m.normRate) DESC) AS rRate
		    FROM sample s JOIN med m USING (personKey, unit, day)),
		norm AS (
		  SELECT m.*, AVG(CASE WHEN s.rRate IN ((m.nRate + 1) / 2, (m.nRate + 2) / 2) THEN s.dRate END) AS madRate
		    FROM med m JOIN spread s USING (personKey, unit, day) GROUP BY m.personKey, m.unit, m.day)
		SELECT l.*, n.normRate, n.madRate, n.nRate,
		       TRIM(CASE WHEN n.nRate >= 5 AND n.madRate > 0 AND abs(0.6745 * (l.treesPerHa - n.normRate) / n.madRate) > 3.5 THEN 'rate ' || rtrim(rtrim(printf('%.2f', l.treesPerHa), '0'), '.') || ' vs usual ' || rtrim(rtrim(printf('%.2f', n.normRate), '0'), '.') || '; ' ELSE '' END || '', '; ') AS flag
		  FROM line l LEFT JOIN norm n ON n.personKey = l.personKey AND n.unit = l.unit AND n.day = l.day);

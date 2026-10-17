// Generated from schema/album-document-v2.schema.json; do not edit.
export type SchemaSurface = {"asset": string; "region"?: (null | [number, number, number, number, number, number, number, number]); "warpRows"?: ([number, number, number, number])[]; "discCalibration"?: SchemaDiscCalibration; "origin"?: string; "sourceUrl"?: string; "sourceReleaseId"?: string};
export type SchemaProvenance = {"origin"?: string; "sourceUrl"?: string; "sourceReleaseId"?: string};
export type SchemaEllipse = {"cx": number; "cy": number; "rx": number; "ry": number; "angle": number};
export type SchemaDiscCalibration = {"outer": SchemaEllipse; "inner"?: SchemaEllipse; "source": "auto" | "manual"; "confidence"?: number};
export type SchemaDimensions = {"width": number; "height": number; "depth": number; "basis": "template" | "measured"; "source"?: string};
export type SchemaPackage = {"id": "package"; "definition": string; "parent": null; "mount": null; "dimensions": SchemaDimensions; "surfaces": {[key: string]: SchemaSurface}; "kind": "package"; "configuration": {"structure"?: "jewel" | "card-sleeve" | "gatefold" | "digipak" | "digibook" | "rigid-box" | "unknown"; "thickness"?: "slim" | "standard" | "thick"; "panels"?: 2 | 3 | 4; "discs"?: 1 | 2 | 3 | 4; "pockets"?: "left" | "right" | "both"; "pocketOpening"?: "outer" | "inner"; "holder"?: "tray" | "pocket"; "tray"?: "clear" | "black" | "white"; "finish"?: "uncoated" | "matte" | "gloss"; "miniLP"?: boolean; "slipcase"?: boolean; "size"?: {"width": number; "height": number; "depth": number}}};
export type SchemaInsert = (SchemaOrdinaryInsert | SchemaBooklet);
export type SchemaSpine = {"widthRatio": number; "basis": "image-estimate"; "asset": string; "origin"?: string; "sourceUrl"?: string; "sourceReleaseId"?: string; "reliefMm"?: (number)[]};
export type SchemaOrdinaryInsert = {"id": string; "definition": string; "parent": string; "mount": string; "dimensions": SchemaDimensions; "surfaces": {[key: string]: SchemaSurface}; "kind": "tray" | "pocket" | "disc" | "obi" | "inner-sleeve"; "contains"?: (string)[]};
export type SchemaBooklet = {"id": string; "definition": string; "parent": string; "mount": string; "dimensions": SchemaDimensions; "surfaces": {[key: string]: SchemaSurface}; "kind": "booklet"; "contains"?: (string)[]; "fold"?: SchemaPaperFold};
export type SchemaPaperFold = {"pattern": "accordion"; "panels": number};
export type SchemaPresentation = {"initialCamera": SchemaInitialCamera};
export type SchemaInitialCamera = {"pitch"?: number; "yaw"?: number; "zoom"?: number; "framingX"?: number; "framingY"?: number};
export type SchemaDocument = {"schemaVersion": 2; "key": string; "title": string; "modelSet": "album-rig-1"; "assembly": {"root": "package"; "components": ((SchemaPackage | SchemaInsert))[]}; "assets": {[key: string]: SchemaProvenance}; "preview"?: SchemaSurface; "calibration"?: {"spine": SchemaSpine}; "placeholderHue"?: 0 | 1 | 2 | 3; "presentation"?: SchemaPresentation};

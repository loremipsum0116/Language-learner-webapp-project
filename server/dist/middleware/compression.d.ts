import { Request, Response, NextFunction } from 'express';
declare const advancedCompression: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
declare const apiResponseOptimization: (req: Request, res: Response, next: NextFunction) => void;
declare const contentTypeOptimization: (req: Request, res: Response, next: NextFunction) => void;
declare const responseSizeMonitoring: (req: Request, res: Response, next: NextFunction) => void;
declare const apiCacheOptimization: (req: Request, res: Response, next: NextFunction) => void;
declare const brotliCompression: (req: Request, res: Response, next: NextFunction) => void;
export { advancedCompression, apiResponseOptimization, contentTypeOptimization, responseSizeMonitoring, apiCacheOptimization, brotliCompression };
//# sourceMappingURL=compression.d.ts.map
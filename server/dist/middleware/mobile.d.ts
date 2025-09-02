import { Request, Response, NextFunction } from 'express';
export declare const detectDevice: (req: Request, res: Response, next: NextFunction) => Response | void;
export declare const validateMobileHeaders: (req: Request, res: Response, next: NextFunction) => Response | void;
export declare const compressionOptimization: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare const setCacheHeaders: (req: Request, res: Response, next: NextFunction) => void;
export declare const batchRequestHandler: (req: Request, res: Response, next: NextFunction) => Response | void;
export declare const offlineSupportHeaders: (req: Request, res: Response, next: NextFunction) => void;
export declare const networkOptimization: (req: Request, res: Response, next: NextFunction) => void;
declare const _default: {
    detectDevice: (req: Request, res: Response, next: NextFunction) => Response | void;
    validateMobileHeaders: (req: Request, res: Response, next: NextFunction) => Response | void;
    compressionOptimization: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
    setCacheHeaders: (req: Request, res: Response, next: NextFunction) => void;
    batchRequestHandler: (req: Request, res: Response, next: NextFunction) => Response | void;
    offlineSupportHeaders: (req: Request, res: Response, next: NextFunction) => void;
    networkOptimization: (req: Request, res: Response, next: NextFunction) => void;
};
export default _default;
//# sourceMappingURL=mobile.d.ts.map
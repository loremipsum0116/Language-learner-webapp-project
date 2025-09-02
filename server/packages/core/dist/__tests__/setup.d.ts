declare global {
    namespace jest {
        interface Matchers<R> {
            toBeWithinRange(min: number, max: number): R;
        }
    }
}
export {};
//# sourceMappingURL=setup.d.ts.map
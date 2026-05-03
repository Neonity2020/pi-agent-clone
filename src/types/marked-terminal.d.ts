declare module "marked-terminal" {
  const Renderer: new (options?: Record<string, any>) => any;
  export default Renderer;
  export function markedTerminal(options?: Record<string, any>, highlightOptions?: Record<string, any>): any;
}

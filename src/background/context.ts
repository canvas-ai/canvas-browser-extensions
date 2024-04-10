const DEFAULT_URL = 'universe:///';

export let context: IContext = {
  url: DEFAULT_URL,
  color: '#fff',
};

export const updateContext = (ctx: IContext | undefined) => {
  context.color = ctx?.color || "#fff";
  context.url = typeof ctx?.url === "string" ? ctx.url : DEFAULT_URL;
  if(ctx?.path) context.path = ctx.path;
  else delete context.path;
  if(ctx?.pathArray) context.pathArray = ctx.pathArray;
  else delete context.pathArray;
  if(ctx?.tree) context.tree = ctx.tree;
  else delete context.tree;
};
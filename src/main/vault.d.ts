// TypeScript declaration for the optional vault module
declare module "../../core/vault/index.js" {
  export interface Vault {
    decryptKnowledgeBase(buf: Buffer, pw: string): Promise<any>;
  }
  const vault: Vault;
  export default vault;
}

declare module 'strong-soap' {
  export namespace soap {
    export class WSDL {
      static open(wsdlUri: string, options: any, callback: (err: any, wsdl: any) => void): void;
    }
    
    export function createClient(wsdlPath: string, options: any, callback: (err: any, client: any) => void): void;
    
    export class BasicAuthSecurity {
      constructor(username: string, password: string);
    }
  }
}
declare module 'word-extractor' {
  class WordExtractor {
    extract(input: string | Buffer): Promise<{ getBody: () => string; getHeaders: () => string; getFooters: () => string }>;
  }
  export default WordExtractor;
}

declare module 'webdav' {
  export function createClient(url: string, options: { username: string; password: string }): any;
}

declare module '@aws-sdk/client-s3' {
  export class S3Client { constructor(config: any); send(command: any): Promise<any>; }
  export class PutObjectCommand { constructor(input: any); }
  export class GetObjectCommand { constructor(input: any); }
}
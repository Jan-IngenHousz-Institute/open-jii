export interface AsyncApiSpec {
  asyncapi: string;
  info: {
    title: string;
    version: string;
    description: string;
    contact?: {
      name?: string;
      email?: string;
    };
    license?: {
      name: string;
      url?: string;
    };
  };
  servers: Record<
    string,
    {
      url: string;
      protocol: string;
      description?: string;
    }
  >;
  channels: Record<
    string,
    {
      description?: string;
      parameters?: Record<
        string,
        {
          description: string;
          schema: {
            type: string;
          };
        }
      >;
      subscribe?: {
        operationId?: string;
        summary?: string;
      };
      publish?: {
        operationId?: string;
        summary?: string;
      };
    }
  >;
  components: {
    messages: Record<
      string,
      {
        name?: string;
        title?: string;
        summary?: string;
        contentType?: string;
        payload?: any;
        examples?: Array<{
          payload: any;
        }>;
      }
    >;
    securitySchemes: Record<
      string,
      {
        type: string;
        in?: string;
        description?: string;
      }
    >;
  };
}

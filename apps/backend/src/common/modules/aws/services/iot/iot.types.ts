export interface CreateThingInput {
  thingName: string;
  attributes: Record<string, string>;
}

export interface CreatedThing {
  thingName: string;
  thingArn: string;
}

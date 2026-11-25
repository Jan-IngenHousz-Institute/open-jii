import type { INestApplication } from "@nestjs/common";
import { Server } from "net";
import request from "supertest";
import type { App } from "supertest/types";

/**
 * Starts an app on 127.0.0.1 and sends requests to it there. Given the server, supertest starts it
 * on every address, which can take a port another local process holds on 127.0.0.1, and then sends
 * to 127.0.0.1, where that process answers. A name such as localhost can resolve to different
 * addresses for the listener and the client, so both use the address itself.
 */
export async function requestsTo(app: INestApplication<App>) {
  await app.listen(0, "127.0.0.1");
  const server = app.getHttpServer();
  const address = server instanceof Server ? server.address() : null;
  if (address === null || typeof address === "string") {
    throw new Error("The test app is not listening on a port.");
  }
  return request(`http://127.0.0.1:${address.port}`);
}

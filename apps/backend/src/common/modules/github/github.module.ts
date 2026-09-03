import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";

import { CacheModule } from "../cache/cache.module";
import { GithubAdapter } from "./github.adapter";
import { GithubConfigService } from "./services/config/config.service";
import { GithubReleasesService } from "./services/releases/releases.service";

@Module({
  imports: [HttpModule.register({ timeout: 30000, maxRedirects: 5 }), CacheModule],
  providers: [GithubConfigService, GithubReleasesService, GithubAdapter],
  exports: [GithubAdapter],
})
export class GithubModule {}

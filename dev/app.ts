import {CoreModule, CoreModuleConfig} from "@jchpro/web-app-core";
import {getInjectorManager, Injectable, InjectableProvider, Provider} from "brit";
import {MongooseModuleConfig} from "@jchpro/web-app-mongoose";
import {User} from "./user";
import {AuthLocalModule} from "../src";
import {UserRouter} from "./user-router";

@InjectableProvider(CoreModuleConfig)
export class CoreModuleConfigProvider implements Provider<CoreModuleConfig> {
  provide(): CoreModuleConfig {
    const config = new CoreModuleConfig();
    config.name = 'Auth-local Module Development';
    config.port = 4002;
    return config;
  }
}

@InjectableProvider(MongooseModuleConfig)
export class MongooseModuleConfigProvider implements Provider<MongooseModuleConfig> {
  provide(): MongooseModuleConfig {
    const config = new MongooseModuleConfig();
    config.dbName = 'dev-database';
    return config;
  }
}

@Injectable()
class WebApp {

  constructor(
    readonly core: CoreModule,
    readonly userModel: User,
    readonly authLocal: AuthLocalModule,
    readonly userRouter: UserRouter
  ) {
    this.core.runServer();
  }

}

getInjectorManager()
  .getInjector()
  .injectFor<WebApp>(WebApp)
  .then(() => {})
  .catch(err => {
    console.error(err)
  });

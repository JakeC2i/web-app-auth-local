import {Class, InjectableProvider, Provider} from "brit";
import {AuthLocalModuleConfig} from "./auth-local-module-config";
import {ModelWrapper} from "@jchpro/web-app-mongoose";
import {AuthLocalModule} from "./auth-local-module";

export function AuthLocalModel<T extends ModelWrapper>(options?: AuthLocalModuleConfig.Options) {
  return function(AuthModel: Class<T>) {

    // Create config class instance, merge options if necessary
    const authLocalConfig = new AuthLocalModuleConfig();
    if (options) {
      authLocalConfig.mergeOptions(options);
    }

    // This class will provide the extended auth model class
    class AuthLocalModelProvider implements Provider<T> {
      provide(...args: any[]): T {

        // Get auth model, read all relevant data
        const authModel = new AuthModel(...args);
        const {schemaDefinition, schemaModifier} = authModel;

        // Extend original parameters according to options
        AuthLocalModule.addDefaultFieldsToSchemaDef(schemaDefinition);
        authModel.schemaModifier = AuthLocalModule.getExtendedAuthSchemaModifier<T>
          (authLocalConfig, authModel, schemaModifier);

        // Register extended model in config
        authLocalConfig.setDecoratedMongooseModel(authModel.model);

        return authModel;
      }
    }
    InjectableProvider(AuthModel)(AuthLocalModelProvider);

    // Provide the auth local config
    class AuthLocalConfigProvider implements Provider<AuthLocalModuleConfig> {
      provide(): AuthLocalModuleConfig {
        return authLocalConfig;
      }
    }
    InjectableProvider(AuthLocalModuleConfig)(AuthLocalConfigProvider);
  }
}

import {Injectable} from "brit";
import {Model} from "mongoose";
import * as _ from 'lodash';

@Injectable()
export class AuthLocalModuleConfig implements AuthLocalModuleConfig.Options {

  private _decoratedModel: Model<any> | undefined;

  usernameField: string = 'name';
  session = {
    useMongooseStore: false,
    mongooseCollection: 'sessions',
    useDBDerivedSecret: false,
    secret: 'keyboard-cat',
    maxAge: 1000 * 60 * 60 * 24 * 7
  };

  setDecoratedMongooseModel(model: Model<any>) {
    if (this._decoratedModel)
      throw new Error('Decorated authorization model has already been registered');
    this._decoratedModel = model;
  }

  getDecoratedMongooseModel(): Model<any> {
    if (!this._decoratedModel)
      throw new Error('Decorated authorization model has not been registered');
    return this._decoratedModel;
  }

  mergeOptions(options: AuthLocalModuleConfig.Options) {
    _.merge(this, options);
  }

}

export namespace AuthLocalModuleConfig {

  export interface Options {
    usernameField?: string;
    session?: {
      useMongooseStore?: boolean;
      mongooseCollection?: string;
      useDBDerivedSecret?: boolean;
      secret?: string;
      maxAge?: number;
    }
  }

}

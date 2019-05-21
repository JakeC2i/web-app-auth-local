import {Injectable} from "brit";
import {CoreModule} from "@jchpro/web-app-core";
import {AuthLocalModule} from "../src";

@Injectable()
export class UserRouter {

  constructor(
    private _core: CoreModule,
    private _authLocal: AuthLocalModule
  ) {
    this._core.app.use('/auth', this._authLocal.authControlRouter());
  }

}

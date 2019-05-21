import {Document} from "mongoose";
import {Injectable} from "brit";
import {AuthLocalModel} from "../src";
import {ModelWrapper} from "@jchpro/web-app-mongoose";

export interface UserData {

  name: string;
  email: string;

  created: Date;
  updated: Date;

}

export interface UserDocument extends UserData, Document {}

@Injectable()
@AuthLocalModel({
  usernameField: 'email',
  session: {
    useMongooseStore: true,
    useDBDerivedSecret: true
  }
})
export class User extends ModelWrapper<UserDocument, UserData> {

  name = 'user';
  schemaDefinition = {};
}

import {AuthLocalModuleConfig} from "./auth-local-module-config";
import {Injectable} from "brit";
import {CoreModule, ErrorHandler} from "@jchpro/web-app-core";
import {Strategy as LocalStrategy} from 'passport-local';
import {ModelWrapper, MongooseModule} from "@jchpro/web-app-mongoose";
import {Schema, SchemaDefinition} from "mongoose";
import {Request, Response, Router} from "express";

const passport = require("passport");
const crypto = require('crypto');
const express = require("express");
const session = require('express-session');
const MongoDBStoreInit = require('connect-mongodb-session');
const passportLocalMongoose = require('passport-local-mongoose');

@Injectable()
export class AuthLocalModule {

  constructor(
    readonly config: AuthLocalModuleConfig,
    private _core: CoreModule,
    private _errorHandler: ErrorHandler,
    private _mongoose: MongooseModule
  ) {
    const app = this._core.app;
    const authModel: any = this.config.getDecoratedMongooseModel();

    const localStrategy = this._getLocalStrategy(authModel);

    if (this.config.session.useMongooseStore) {
      this._setupSessionStore();
    }

    passport.use('local', localStrategy );
    passport.serializeUser(authModel.serializeUser() );
    passport.deserializeUser(authModel.deserializeUser() );

    app.use(passport.initialize());
    app.use(passport.session());

    this._registerAuthErrorHandler();

    this._core.log.info('Local authentication set up')
  }

  private _getLocalStrategy(authModel: any): LocalStrategy {
    return new LocalStrategy({
      usernameField: this.config.usernameField
    }, authModel.authenticate());
  }

  private _setupSessionStore() {
    const app = this._core.app;
    const MongoDBStore = MongoDBStoreInit(session);
    const store = new MongoDBStore({
      uri: this._mongoose.config.mongoDBUri,
      collection: this.config.session.mongooseCollection
    });
    if (this.config.session.useDBDerivedSecret) {
      this.config.session.secret = crypto.createHash('sha512')
        .update(this._mongoose.config.mongoDBUri)
        .digest('hex');
    }
    app.use(session({
      secret: this.config.session.secret,
      cookie: {
        maxAge: this.config.session.maxAge
      },
      store: store,
      resave: true,
      saveUninitialized: false,
      unset: 'destroy'
    }));
    this._core.log.info('Sessions with Mongoose store ready');
  }

  private _registerAuthErrorHandler() {
    this._errorHandler.addHandler((err: Error) => {
      const {PASSPORT_ERRORS, GENERIC_LOGIN_FAILURE_ERROR, GENERIC_LOGIN_FAILURE_MESSAGE}
        = AuthLocalModule;
      if (err.name === PASSPORT_ERRORS.WRONG_PASSWORD || err.name === PASSPORT_ERRORS.WRONG_USER) {
        this._core.log.warn(`User authentication failed: ${err.message}`);
        return {
          name: GENERIC_LOGIN_FAILURE_ERROR,
          message: GENERIC_LOGIN_FAILURE_MESSAGE,
          httpCode: 401
        };
      }
    });
  }

  private _respondWithStatus = (res: Response, maybeUser?: any) => {
    if (maybeUser) {
      res.json({
        loggedIn: true,
        user: maybeUser
      });
    } else {
      res.json({
        loggedIn: false
      });
    }
  };

  private _getUserName(user: any) {
    return user[this.config.usernameField];
  }

  authControlRouter(router?: Router): Router {
    router = (router || express.Router()) as Router;

    // Logging in / out
    router
      .get('/status', (req, res: Response) => {
        this._respondWithStatus(res, req.user);
      })
      .post('/logout', (req, res: Response) => {
        const msg = `User ${this._getUserName(req.user)} logged out`;
        req.logout();
        this._core.log.info(msg);
        this._respondWithStatus(res);
      })
      .post('/login', (req, res, next) => {
        passport.authenticate('local', (err: Error, user: Document, info: any) => {
          if (err) { return next(err) }
          if (!user) {
            return this._errorHandler.handleApiError(info, res);
          }
          req.logIn(user, (err: Error) => {
            if (err) { return next(err); }
            this._core.log.info(`User ${this._getUserName(req.user)} logged in`);
            return next();
          });
        })(req, res, next);
      }, (req, res) => {
        this._respondWithStatus(res, req.user);
      });
    // TEMPORARY user creation
    // .post('/login', (req, res) => {
    //
    //   const AuthMongooseModel = this.config.getDecoratedMongooseModel();
    //   let newUser = new AuthMongooseModel(req.body);
    //   newUser.name = 'jchpro';
    //
    //   // TODO typings!
    //   (AuthMongooseModel as any).register(newUser, req.body.password, (err: any) => {
    //     if (err) return res.status(500).json(err);
    //     res.json(newUser);
    //   });
    // });

    // Changing password
    router
      .all(AuthLocalModule.ensureAuth())
      .post('/password', (req: any, res: any) => {
        req.user.changePassword(req.body.oldPassword, req.body.newPassword, (err: Error) => {
          if (err) return this._errorHandler.handleApiError(err, res);

          req.user.save()
            .then(() => {
              res.json(true);
            })
            .catch((err: Error) => this._errorHandler.handleApiError(err, res));
        });
      });

    return router;
  }
}

export namespace AuthLocalModule {

  export const PASSPORT_ERRORS = {
    WRONG_PASSWORD: 'IncorrectPasswordError',
    WRONG_USER: 'IncorrectUsernameError'
  };

  export const GENERIC_LOGIN_FAILURE_ERROR = PASSPORT_ERRORS.WRONG_PASSWORD;
  export const GENERIC_LOGIN_FAILURE_MESSAGE = 'Incorrect username or password';

  function addNameFieldToSchemaDef(schema: SchemaDefinition) {
    schema.name = {
      type: String,
      trim: true,
      required: true
    };
  }

  function addEmailFieldToSchemaDef(schema: SchemaDefinition) {
    schema.email = {
      type: String,
      match: [/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/, 'Incorrect e-mail'],
      required: true
    };
  }

  export function addDefaultFieldsToSchemaDef(schema: SchemaDefinition) {
    addNameFieldToSchemaDef(schema);
    addEmailFieldToSchemaDef(schema);
  }

  export function getExtendedAuthSchemaModifier<T extends ModelWrapper = any>(
    config: AuthLocalModuleConfig,
    modelWrapper: T,
    originalModifier?: ModelWrapper.SchemaModifier
  )
    : ModelWrapper.SchemaModifier {
    return function authSchemaModifier(schema: Schema, options: ModelWrapper.Options) {

      schema.plugin(passportLocalMongoose, {usernameField: config.usernameField});

      schema.set('toJSON', {
        transform: function(doc: any, user: any) {
          delete user.salt;
          delete user.hash;
          return user;
        }
      });

      if (typeof originalModifier === 'function') {
        originalModifier.bind(modelWrapper)(schema, options);
      }
    };
  }

  export function ensureAuth(): any {
    return function ensureAuthMiddleware(req: Request, res: Response, next: Function) {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        res.status(401).json({message: 'unauthorized'});
        return;
      }
      next();
    }
  }
}

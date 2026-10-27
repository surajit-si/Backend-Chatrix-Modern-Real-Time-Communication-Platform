import { Router } from "express";
import { stayAwake } from "../controllers/stayAwake.controller.js";

const awakeRouter = Router();

awakeRouter.route("/").get(stayAwake);

export default awakeRouter;

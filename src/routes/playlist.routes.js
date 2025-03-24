import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  getPlaylist,
  getAllPlaylists,
  createPlaylist,
  deletePlaylist,
  updatePlaylist,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
} from "../controllers/playlist.controller.js";

const router = Router();
router.use(verifyJWT);

router.route("/").post(createPlaylist);

router
  .route("/:playlistId")
  .get(getPlaylist)
  .patch(updatePlaylist)
  .delete(deletePlaylist);

router.route("/user/:userId").get(getAllPlaylists);

router.route("/add/:playlistId/:videoId").patch(addVideoToPlaylist);
router.route("/remove/:playlistId/:videoId").patch(removeVideoFromPlaylist);

export default router;

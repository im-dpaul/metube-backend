import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Playlist } from "../models/playlist.model.js";
import { Video } from "../models/video.model.js";
import { Types } from "mongoose";

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name || !description) {
    throw new ApiError(400, "Playlist name & description are required");
  }

  const playlist = await Playlist.create({
    name,
    description,
    videos: [],
    creator: req.user?._id,
  });

  if (!playlist) {
    throw new ApiError(400, "Unable to create new playlist");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, playlist, "Playlist created successfully"));
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  if (!playlistId) {
    throw new ApiError(400, "Playlist id is required");
  }

  const { name, description } = req.body;
  if (!name || !description) {
    throw new ApiError(400, "Playlist name & description are required");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (!playlist.creator.equals(req.user?._id)) {
    throw new ApiError(401, "You are not authorized to update the playlist");
  }

  playlist.name = name;
  playlist.description = description;
  await playlist.save();

  return res
    .status(200)
    .json(new ApiResponse(200, playlist, "Playlist updated successfuly"));
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  if (!playlistId) {
    throw new ApiError(400, "Playlist id is required");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (!playlist.creator.equals(req.user?._id)) {
    throw new ApiError(401, "You are not authorized to delete the playlist");
  }

  const deletedPlaylist = await Playlist.findByIdAndDelete(playlistId);
  if (!deletedPlaylist) {
    throw new ApiError(400, "Could not delete Playlist");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Playlist deleted successfully"));
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  if (!playlistId) {
    throw new ApiError(400, "Playlist id is required");
  }
  if (!videoId) {
    throw new ApiError(400, "Video id is required");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(400, "Playlist not found");
  }
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(400, "Video not found");
  }

  if (!playlist.creator.equals(req.user?._id)) {
    throw new ApiError(401, "You are not authorized to Video in this Playlist");
  }

  playlist.videos.addToSet(videoId);
  await playlist.save();

  return res
    .status(200)
    .json(
      new ApiResponse(200, playlist, "Video added to the playlist successfully")
    );
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  if (!playlistId) {
    throw new ApiError(400, "Playlist id is required");
  }
  if (!videoId) {
    throw new ApiError(400, "Video id is required");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(400, "Playlist not found");
  }

  if (!playlist.creator.equals(req.user?._id)) {
    throw new ApiError(
      401,
      "You are not authorized to remove Video from this Playlist"
    );
  }

  playlist.videos.pull(videoId);
  await playlist.save();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        playlist,
        "Video removed from the playlist successfully"
      )
    );
});

const getAllPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    throw new ApiError("User id is required");
  }

  const playlists = await Playlist.aggregate([
    { $match: { creator: new Types.ObjectId(userId) } },
    {
      $addFields: {
        videoCount: {
          $size: "$videos",
        },
      },
    },
    {
      $project: {
        name: 1,
        description: 1,
        videoCount: 1,
        creator: 1,
      },
    },
  ]);

  if (playlists.length === 0) {
    throw new ApiError(400, "No playlist found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, playlists, "All playlists fetched successfully")
    );
});

const getPlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  if (!playlistId) {
    throw new ApiError(400, "Playlist id is required");
  }

  const playlist = await Playlist.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(playlistId) } },
    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
        pipeline: [
          {
            $project: {
              title: 1,
              description: 1,
              videoFile: 1,
              thumbnail: 1,
              views: 1,
              duration: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "creator",
        foreignField: "_id",
        as: "creator",
        pipeline: [
          {
            $project: {
              username: 1,
              fullName: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        creator: { $first: "$creator" },
      },
    },
  ]);

  if (!playlist[0]) {
    throw new ApiError(400, "Playlist not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, playlist[0], "Playlist fetched successfully"));
});

export {
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  getAllPlaylists,
  getPlaylist,
};

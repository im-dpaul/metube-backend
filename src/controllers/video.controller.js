import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Video } from "../models/video.model.js";
import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import {
  removeFromCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";

const publishVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  if (!title || !description) {
    throw new ApiError(400, "Video title & description are required");
  }

  let { video, thumbnail } = req.files;
  if (!video || !thumbnail) {
    throw new ApiError(400, "Video & thumbnail are required");
  }

  video = await uploadOnCloudinary(video[0].path);
  thumbnail = await uploadOnCloudinary(thumbnail[0].path);
  if (!video?.url || !thumbnail?.url) {
    throw new ApiError(500, "Something went wrong while uploading video");
  }

  const uploadedVideo = await Video.create({
    videoFile: video.url,
    thumbnail: thumbnail.url,
    title,
    description,
    duration: video.duration,
    owner: req.user?._id,
  });

  if (!uploadedVideo.videoFile) {
    throw new ApiError(400, "Unable to upload video file");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, uploadedVideo, "Video published successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) {
    throw new ApiError(400, "Video id is required");
  }

  const { title, description } = req.body;
  if (!title || !description) {
    throw new ApiError(400, "Video title and description is required");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(400, "Could not found video");
  }

  if (!video.owner._id.equals(req.user?._id)) {
    throw new ApiError(
      401,
      "You are not authorized to update details of the video"
    );
  }

  let thumbnail = video.thumbnail;

  const thumbnailLocalPath = req.file?.path;
  if (thumbnailLocalPath) {
    let lastThumbnail = thumbnail.split("/");
    lastThumbnail = lastThumbnail[lastThumbnail.length - 1].split(".")[0];

    thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
    thumbnail = thumbnail.url;

    await removeFromCloudinary(lastThumbnail);
  }

  video.title = title;
  video.description = description;
  video.thumbnail = thumbnail;
  await video.save();

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) {
    throw new ApiError(400, "Video id is required");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(400, "Could not found video");
  }

  if (!video.owner._id.equals(req.user?._id)) {
    throw new ApiError(401, "You are not authorized to delete the video");
  }

  let videoUrl = video.videoFile.split("/");
  videoUrl = videoUrl[videoUrl.length - 1].split(".")[0];
  await removeFromCloudinary(videoUrl, "video");

  let thumbnailUrl = video.thumbnail.split("/");
  thumbnailUrl = thumbnailUrl[thumbnailUrl.length - 1].split(".")[0];
  await removeFromCloudinary(thumbnailUrl);

  const result = await Video.findByIdAndDelete(videoId);
  if (!result) {
    throw new ApiError(400, "Unable to delete the video");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) {
    throw new ApiError(400, "Video id is required");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (!video.owner._id.equals(req.user?._id)) {
    throw new ApiError(
      401,
      "You are not authorized to update publish status of the video"
    );
  }

  video.isPublished = !video.isPublished;
  await video.save();

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Updated video publish status"));
});

const getAllVideos = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    query = "",
    sortBy = "createdAt",
    sortType = 1,
    userId,
  } = req.query;

  let matchCondition = {
    isPublished: true,
    $or: [
      { title: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
    ],
  };

  if (userId) {
    matchCondition.owner = new mongoose.Types.ObjectId(userId);
  }

  const aggregate = Video.aggregate([
    {
      $match: matchCondition,
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              fullName: 1,
              avatar: 1,
              username: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        owner: {
          $first: "$owner",
        },
      },
    },
    {
      $sort: {
        [sortBy || "createdAt"]: sortType,
      },
    },
  ]);

  const options = {
    page,
    limit,
    customLabels: {
      totalDocs: "totalVideos",
      docs: "videos",
    },
    skip: (page - 1) * limit,
  };

  const videos = await Video.aggregatePaginate(aggregate, options);

  if (videos.videos.length === 0) {
    throw new ApiError(404, "No video found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, videos.videos, "Videos fetched successfully"));
});

const getVideo = asyncHandler(async (req, res) => {
  const videoId = req.params.videoId;
  if (!videoId) {
    throw new ApiError(400, "Video id is required");
  }

  const video = await Video.aggregate([
    {
      $match: { _id: new mongoose.Types.ObjectId(videoId), isPublished: true },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              fullName: 1,
              avatar: 1,
              username: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        owner: { $first: "$owner" },
      },
    },
  ]);

  if (!video[0]) {
    throw new ApiError(404, "Video not found");
  }

  await Video.findByIdAndUpdate(videoId, {
    $inc: { views: 1 },
  });

  await User.findByIdAndUpdate(req.user?._id, {
    $addToSet: {
      watchHistory: videoId,
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, video[0], "Video fetched successfully"));
});

export {
  publishVideo,
  updateVideo,
  deleteVideo,
  getVideo,
  getAllVideos,
  togglePublishStatus,
};

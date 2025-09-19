import { PlayCircle } from "lucide-react";

const VideoCard = ({ video, onClick }) => (
  <div
    className="group cursor-pointer rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300 bg-white"
    onClick={() => onClick(video.video_id)}
  >
    <div className="relative">
      <img
        src={video.thumbnail_url}
        alt={video.title}
        className="w-full h-40 object-cover"
      />
      <div className="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-50 transition-all flex items-center justify-center">
        <PlayCircle className="w-12 h-12 text-white text-opacity-80 group-hover:text-opacity-100 transform group-hover:scale-110 transition-transform" />
      </div>
    </div>
    <div className="p-4">
      <h3 className="font-semibold text-gray-800 truncate" title={video.title}>
        {video.title}
      </h3>
      <p className="text-sm text-gray-500">
        {video.src_lang.toUpperCase()} → {video.tgt_lang.toUpperCase()}
      </p>
    </div>
  </div>
);

export const SavedVideosList = ({ videos, onVideoSelect }) => {
  if (!videos || videos.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <h3 className="text-xl font-semibold text-gray-700">
          Your Video Library is Empty
        </h3>
        <p className="text-gray-500 mt-2">
          Use the form above to save your first YouTube video.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-4">My Saved Videos</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {videos.map((video) => (
          <VideoCard
            key={video.video_id}
            video={video}
            onClick={onVideoSelect}
          />
        ))}
      </div>
    </div>
  );
};

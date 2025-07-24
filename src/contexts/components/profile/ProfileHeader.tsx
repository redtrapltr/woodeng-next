import React from 'react';
import { Camera, Music2, User, ArrowUpRight, Shield } from 'lucide-react';
import { useUserStore } from '@/stores/userStore';
import { cn }           from '@/lib/utils';
import { ImageUpload }  from '@/components/profile/ImageUpload';
interface ProfileHeaderProps {
  username: string;
  bio: string;
  avatarUrl: string;
  coverUrl?: string;
  isVerified: boolean;
  isArtist: boolean;
  userId: string;
  onEditProfile: () => void;
}

const DEFAULT_AVATAR = "https://i.postimg.cc/sXyhngcW/Woo.png";
const DEFAULT_COVER = "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&h=400&fit=crop";

export function ProfileHeader({ 
  username, 
  bio, 
  avatarUrl,
  coverUrl,
  isVerified, 
  isArtist,
  userId,
  onEditProfile 
}: ProfileHeaderProps) {
  const { user, updateUser } = useUserStore();
  
  const isCurrentUser = user?.id === userId;

  const handleCoverImageChange = (url: string) => {
    if (user && isCurrentUser) {
      updateUser({
        ...user,
        coverUrl: url
      });
    }
  };

  const handleAvatarChange = (url: string) => {
    if (user && isCurrentUser) {
      updateUser({
        ...user,
        avatarUrl: url
      });
    }
  };

  return (
    <div className="relative">
      {/* Cover Image */}
      <div className="relative h-48 md:h-80 -mx-4 group">
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={coverUrl || DEFAULT_COVER}
            alt={`${username}'s cover`}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        </div>
        
        {isCurrentUser && (
          <div className="absolute inset-0 flex items-end justify-end p-4">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
              <ImageUpload
                currentImage={coverUrl}
                onImageChange={handleCoverImageChange}
                customButton={
                  <button className="p-3 bg-black/50 rounded-full backdrop-blur-sm hover:bg-black/70 transition-colors">
                    <Camera className="w-5 h-5 text-white" />
                  </button>
                }
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Profile Info */}
      <div className="relative -mt-20 px-4">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Avatar */}
          <div className="relative group">
            {isCurrentUser ? (
              <div className="relative">
                <img 
                  src={avatarUrl || DEFAULT_AVATAR}
                  alt={username}
                  className="w-32 h-32 rounded-full border-4 border-background object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <ImageUpload
                    currentImage={avatarUrl}
                    onImageChange={handleAvatarChange}
                    customButton={
                      <button className="p-3 bg-black/50 rounded-full backdrop-blur-sm hover:bg-black/70 transition-colors">
                        <Camera className="w-5 h-5 text-white" />
                      </button>
                    }
                  />
                </div>
              </div>
            ) : (
              <img 
                src={avatarUrl || DEFAULT_AVATAR}
                alt={username}
                className="w-32 h-32 rounded-full border-4 border-background object-cover"
              />
            )}
            {isVerified && (
              <div className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-2 rounded-full">
                <Shield className="w-5 h-5" />
              </div>
            )}
          </div>
          
          {/* User Info */}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h1 className="text-3xl font-bold">{username}</h1>
              {isVerified && (
                <Shield className="w-5 h-5 text-primary" />
              )}
              {isArtist && (
                <span className="px-2 py-1 bg-primary/10 text-primary text-sm rounded-full">
                  Artist
                </span>
              )}
            </div>
            
            <p className="text-muted-foreground max-w-2xl mb-6">{bio}</p>
            
            {isCurrentUser ? (
              <button 
                onClick={onEditProfile}
                className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-muted transition-colors rounded-lg"
              >
                <User className="w-4 h-4" />
                Edit Profile
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
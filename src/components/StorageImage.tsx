import React, { useState, useEffect } from 'react';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { getCloudConfig } from '../services/cloudConfig';
import { initializeApp, getApps } from 'firebase/app';

interface StorageImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  imageStoragePath?: string;
  fallbackSrc?: string;
}

export const StorageImage: React.FC<StorageImageProps> = ({ imageStoragePath, fallbackSrc, alt, className, ...props }) => {
  const [url, setUrl] = useState<string | undefined>(fallbackSrc);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (imageStoragePath) {
      const fetchUrl = async () => {
        try {
          setLoading(true);
          const { firebaseConfig, useLiveFirebase } = getCloudConfig();
          if (!useLiveFirebase || !firebaseConfig.apiKey) {
            setUrl(fallbackSrc);
            return;
          }
          const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
          const storage = getStorage(app);
          const downloadUrl = await getDownloadURL(ref(storage, imageStoragePath));
          setUrl(downloadUrl);
        } catch (err) {
          console.warn('Failed to load storage image:', err);
          setUrl(fallbackSrc);
        } finally {
          setLoading(false);
        }
      };
      fetchUrl();
    } else {
      setUrl(fallbackSrc);
    }
  }, [imageStoragePath, fallbackSrc]);

  if (!url && loading) {
    return <div className={`animate-pulse bg-slate-200 ${className || ''}`} />;
  }

  if (!url) {
    return null;
  }

  return <img src={url} alt={alt || 'Citizen Evidence'} className={className} {...props} />;
};

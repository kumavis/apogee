import React, { useState, useRef, useCallback } from 'react';
import ReactCrop, { 
  Crop, 
  PixelCrop,
  centerCrop,
  makeAspectCrop
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

type ImageEditorCropProps = {
  onImageChange: (dataUri: string | null) => void;
  initialImage?: string | null;
  width?: number;
  height?: number;
};

const ImageEditorCrop: React.FC<ImageEditorCropProps> = ({ 
  onImageChange, 
  initialImage = null,
  width = 336,
  height = 180
}) => {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Calculate aspect ratio from desired dimensions
  const aspect = width / height; // 336/180 = 1.867

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined); // Makes crop preview update between images.
      const reader = new FileReader();
      reader.addEventListener('load', () =>
        setImgSrc(reader.result?.toString() || '')
      );
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: imgWidth, naturalHeight: imgHeight } = e.currentTarget;

    // Create a centered crop with our target aspect ratio
    const initialCrop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90, // Use 90% of the image width initially
        },
        aspect,
        imgWidth,
        imgHeight
      ),
      imgWidth,
      imgHeight
    );

    setCrop(initialCrop);
  };

  const generateCroppedImage = useCallback(async () => {
    const image = imgRef.current;
    const canvas = canvasRef.current;
    const crop = completedCrop;

    if (!image || !canvas || !crop) {
      return;
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const offscreen = new OffscreenCanvas(width, height);
    const ctx = offscreen.getContext('2d');

    if (!ctx) {
      return;
    }

    // Draw the cropped image to match our exact dimensions
    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      width,
      height
    );

    // Convert to blob and then to data URI
    const blob = await offscreen.convertToBlob({ type: 'image/png' });
    const reader = new FileReader();
    reader.onload = () => {
      onImageChange(reader.result as string);
    };
    reader.readAsDataURL(blob);
  }, [completedCrop, width, height, onImageChange]);

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (!file) continue;

        setCrop(undefined);
        const reader = new FileReader();
        reader.addEventListener('load', () =>
          setImgSrc(reader.result?.toString() || '')
        );
        reader.readAsDataURL(file);
        break;
      }
    }
  }, []);

  const handleClear = () => {
    setImgSrc('');
    setCrop(undefined);
    setCompletedCrop(undefined);
    onImageChange(null);
  };

  // Set up global paste event listener
  React.useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Only handle paste if no other input is focused
      if (document.activeElement?.tagName === 'INPUT' || 
          document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      handlePaste(e);
    };

    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, [handlePaste]);

  // Load initial image if provided
  React.useEffect(() => {
    if (initialImage && !imgSrc) {
      setImgSrc(initialImage);
    }
  }, [initialImage, imgSrc]);

  // Generate cropped image when crop changes
  React.useEffect(() => {
    if (completedCrop && imgRef.current) {
      generateCroppedImage();
    }
  }, [completedCrop, generateCroppedImage]);

  return (
    <div style={{
      background: 'rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      padding: 16
    }}>
      <h4 style={{ 
        margin: '0 0 12px 0', 
        color: '#00ffff', 
        fontSize: 16 
      }}>
        🎨 Card Image Editor
      </h4>
      
      <p style={{
        fontSize: 12,
        color: '#888',
        margin: '0 0 12px 0',
        textAlign: 'center'
      }}>
        Upload or paste an image, then crop to {width}×{height}px to fill the entire card
      </p>

      {/* File Upload */}
      <div style={{ marginBottom: 16 }}>
        <label style={{
          display: 'block',
          padding: '12px',
          background: 'rgba(0,255,255,0.2)',
          border: '2px dashed rgba(0,255,255,0.4)',
          borderRadius: 8,
          color: '#00ffff',
          fontSize: 14,
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}>
          📁 Upload Image or Paste (Ctrl+V)
          <input
            type="file"
            accept="image/*"
            onChange={onSelectFile}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {/* Crop Interface */}
      {imgSrc && (
        <div style={{ marginBottom: 16 }}>
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspect}
            style={{
              maxWidth: '100%',
              borderRadius: 4
            }}
          >
            <img
              ref={imgRef}
              alt="Crop me"
              src={imgSrc}
              style={{ 
                maxWidth: '100%', 
                height: 'auto',
                borderRadius: 4
              }}
              onLoad={onImageLoad}
            />
          </ReactCrop>
        </div>
      )}

      {/* Hidden canvas for image processing */}
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
        width={width}
        height={height}
      />

      {/* Action Buttons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8
      }}>
        {/* Apply Crop */}
        <button
          onClick={generateCroppedImage}
          disabled={!completedCrop}
          style={{
            padding: '8px 12px',
            background: completedCrop ? 'rgba(0,255,0,0.2)' : 'rgba(100,100,100,0.2)',
            border: `1px solid ${completedCrop ? 'rgba(0,255,0,0.4)' : 'rgba(100,100,100,0.4)'}`,
            borderRadius: 4,
            color: completedCrop ? '#00ff00' : '#666',
            fontSize: 12,
            cursor: completedCrop ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease'
          }}
        >
          ✅ Apply Crop
        </button>

        {/* Clear */}
        <button
          onClick={handleClear}
          style={{
            padding: '8px 12px',
            background: 'rgba(255,68,68,0.2)',
            border: '1px solid rgba(255,68,68,0.4)',
            borderRadius: 4,
            color: '#ff4444',
            fontSize: 12,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          🗑️ Clear
        </button>
      </div>

      <p style={{
        fontSize: 11,
        color: '#888',
        margin: '8px 0 0 0',
        textAlign: 'center'
      }}>
        Upload images • Paste with Ctrl+V • Crop to fill entire card (120×168px)
      </p>
    </div>
  );
};

export default ImageEditorCrop;

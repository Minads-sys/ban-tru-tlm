/**
 * Smart Client-side Image Compressor
 * Nén ảnh biên bản giao nhận/ký nhận ngay tại thiết bị trước khi upload
 * Giảm dung lượng từ 5-10MB xuống còn 150-300KB nhưng vẫn sắc nét, đọc rõ chữ ký và con số.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0 (default: 0.78)
  format?: 'image/webp' | 'image/jpeg';
}

export interface CompressedImageResult {
  file: File;
  blob: Blob;
  dataUrl: string;
  originalSizeKb: number;
  compressedSizeKb: number;
  compressionRatioPercent: number;
  width: number;
  height: number;
}

export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressedImageResult> {
  const {
    maxWidth = 1800,
    maxHeight = 1800,
    quality = 0.78,
    format = 'image/webp',
  } = options;

  const originalSizeKb = Math.round(file.size / 1024);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = (err) => reject(new Error('Không thể đọc file ảnh: ' + err));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = (err) => reject(new Error('Không thể nạp dữ liệu ảnh: ' + err));
      img.onload = () => {
        try {
          let { width, height } = img;

          // Tính toán kích thước mới giữ nguyên tỉ lệ
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('Trình duyệt không hỗ trợ Canvas 2D'));
          }

          // Khử răng cưa và làm mịn ảnh để chữ viết tay và chữ ký sắc nét
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Vẽ nền trắng (đặc biệt cần thiết nếu ảnh gốc là PNG trong suốt)
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);

          // Vẽ ảnh lên canvas
          ctx.drawImage(img, 0, 0, width, height);

          // Thử xuất ra WebP, nếu không hỗ trợ sẽ fallback sang JPEG
          let outputFormat = format;
          let dataUrl = canvas.toDataURL(outputFormat, quality);
          if (!dataUrl.startsWith(`data:${outputFormat}`)) {
            outputFormat = 'image/jpeg';
            dataUrl = canvas.toDataURL(outputFormat, quality);
          }

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                return reject(new Error('Lỗi chuyển đổi canvas sang Blob'));
              }

              const compressedSizeKb = Math.round(blob.size / 1024);
              const compressionRatioPercent = originalSizeKb > 0
                ? Math.round(((originalSizeKb - compressedSizeKb) / originalSizeKb) * 100)
                : 0;

              // Tạo File mới với tên file phù hợp đuôi định dạng
              const extension = outputFormat === 'image/webp' ? 'webp' : 'jpg';
              const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
              const newFileName = `${baseName}_compressed.${extension}`;
              const compressedFile = new File([blob], newFileName, {
                type: outputFormat,
                lastModified: Date.now(),
              });

              resolve({
                file: compressedFile,
                blob,
                dataUrl,
                originalSizeKb,
                compressedSizeKb,
                compressionRatioPercent: Math.max(0, compressionRatioPercent),
                width,
                height,
              });
            },
            outputFormat,
            quality
          );
        } catch (error) {
          reject(error);
        }
      };

      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

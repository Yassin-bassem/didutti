import { useState, useCallback, useRef } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { QrCode, X, Camera, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface QRScannerProps {
  onScan: (code: string) => void;
}

const QRScanner = ({ onScan }: QRScannerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannerKey, setScannerKey] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const hasScannedRef = useRef(false);

  const requestCameraAndOpen = useCallback(async () => {
    setError(null);
    setIsStarting(true);
    hasScannedRef.current = false;

    try {
      // Pre-request camera permission with a direct user gesture
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      // Stop the stream immediately — the Scanner component will open its own
      stream.getTracks().forEach((t) => t.stop());

      setScannerKey((k) => k + 1);
      setIsOpen(true);
    } catch (err: any) {
      console.error('Camera permission error:', err);
      if (err.name === 'NotAllowedError') {
        setError('يرجى السماح بالوصول للكاميرا من إعدادات المتصفح ثم المحاولة مرة أخرى');
      } else if (err.name === 'NotFoundError') {
        setError('لا توجد كاميرا متاحة على هذا الجهاز');
      } else if (err.name === 'NotReadableError') {
        setError('الكاميرا مستخدمة من تطبيق آخر، أغلقه وحاول مرة أخرى');
      } else {
        setError('فشل في تشغيل الكاميرا، حاول مرة أخرى');
      }
    } finally {
      setIsStarting(false);
    }
  }, []);

  const handleScan = useCallback(
    (result: any) => {
      if (hasScannedRef.current) return;
      if (result && result[0]?.rawValue) {
        hasScannedRef.current = true;
        const scannedCode = result[0].rawValue;
        onScan(scannedCode);
        setIsOpen(false);
        setError(null);
      }
    },
    [onScan],
  );

  const handleError = useCallback((err: any) => {
    console.error('QR Scanner error:', err);
    const msg = typeof err === 'string' ? err : err?.message || '';
    if (/not allowed|permission/i.test(msg)) {
      setError('يرجى السماح بالوصول للكاميرا من إعدادات المتصفح');
    } else if (/not found/i.test(msg)) {
      setError('لا توجد كاميرا متاحة');
    } else if (/not readable|could not start/i.test(msg)) {
      setError('الكاميرا مستخدمة من تطبيق آخر');
    } else {
      setError('فشل في تشغيل الكاميرا');
    }
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    setScannerKey((k) => k + 1);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setError(null);
  }, []);

  return (
    <>
      <Button
        onClick={requestCameraAndOpen}
        disabled={isStarting}
        size="lg"
        className="w-full gap-3 rounded-2xl bg-gradient-to-l from-primary to-secondary py-8 text-lg font-bold shadow-baby-lg transition-all hover:shadow-pink hover:scale-[1.02] btn-bounce"
      >
        {isStarting ? (
          <RefreshCw className="h-8 w-8 animate-spin" />
        ) : (
          <QrCode className="h-8 w-8" />
        )}
        <span>مسح كود QR</span>
        <Camera className="h-6 w-6 opacity-70" />
      </Button>

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center justify-between">
              <span className="gradient-text">مسح كود المنتج</span>
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="h-5 w-5" />
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="relative aspect-square w-full bg-foreground/5">
            {isOpen && (
              <Scanner
                key={scannerKey}
                onScan={handleScan}
                onError={handleError}
                constraints={{ facingMode: 'environment' }}
                scanDelay={300}
                styles={{
                  container: { width: '100%', height: '100%' },
                  video: { width: '100%', height: '100%', objectFit: 'cover' },
                }}
              />
            )}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-16 border-4 border-primary rounded-2xl opacity-50" />
              <div className="absolute top-16 left-16 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
              <div className="absolute top-16 right-16 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
              <div className="absolute bottom-16 left-16 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
              <div className="absolute bottom-16 right-16 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
            </div>
          </div>

          {error && (
            <div className="p-4 text-center space-y-3">
              <p className="text-destructive text-sm">{error}</p>
              <Button variant="outline" size="sm" onClick={handleRetry} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                إعادة المحاولة
              </Button>
            </div>
          )}

          <div className="p-4 text-center text-muted-foreground text-sm">
            وجّه الكاميرا نحو كود QR الخاص بالمنتج
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QRScanner;

import type { AdType } from '../../types/ads';
import { Globe, MoreHorizontal, ThumbsUp, MessageSquare, Share2 } from 'lucide-react';

interface AdCreativePreviewProps {
  platform: 'GOOGLE' | 'FACEBOOK';
  adType: AdType;
  creative: any;
}

export default function AdCreativePreview({ platform, adType, creative }: AdCreativePreviewProps) {
  if (platform === 'GOOGLE') {
    return (
      <div className="max-w-[600px] border border-border rounded-lg bg-surface p-4 text-sm font-sans shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold text-text-main text-[13px]">Ad</span>
          <span className="text-[13px] text-text-main font-semibold">· {creative.finalUrl || 'www.example.com'}</span>
        </div>
        <div className="text-xl text-blue-600 hover:underline cursor-pointer mb-1 leading-tight">
          {(creative.headlines || []).slice(0, 3).join(' | ') || 'Headline 1 | Headline 2 | Headline 3'}
        </div>
        <div className="text-[#4d5156] leading-snug">
          {(creative.descriptions || []).slice(0, 2).join(' ') || 'This is a description for your Google Ad. It highlights your key value propositions and encourages users to click.'}
        </div>
      </div>
    );
  }

  // Facebook
  return (
    <div className="max-w-[400px] border border-border rounded-xl bg-surface overflow-hidden font-sans shadow-sm">
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-border flex items-center justify-center font-bold text-text-muted">P</div>
          <div>
            <div className="font-semibold text-text-main text-[15px]">{creative.facebookPageId || 'Your Page Name'}</div>
            <div className="flex items-center gap-1 text-[13px] text-text-muted">
              <span>Sponsored</span> <Globe className="w-3 h-3" />
            </div>
          </div>
        </div>
        <MoreHorizontal className="w-5 h-5 text-text-muted" />
      </div>

      <div className="px-3 pb-3 text-[15px] text-text-main whitespace-pre-wrap">
        {creative.primaryText || 'Here is the primary text for your Facebook Ad. It tells people what you are promoting.'}
      </div>

      {creative.imageUrls?.[0] ? (
        <div className="aspect-square w-full bg-border">
          <img src={creative.imageUrls[0]} alt="Ad Creative" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="aspect-square w-full bg-border flex items-center justify-center text-text-muted">
          No Image Selected
        </div>
      )}

      <div className="bg-background/50 border-t border-border p-3 flex items-center justify-between">
        <div>
          <div className="text-[12px] text-text-muted uppercase tracking-wide">{creative.finalUrl?.replace(/^https?:\/\//, '').split('/')[0] || 'EXAMPLE.COM'}</div>
          <div className="font-semibold text-text-main text-[17px] leading-tight mt-0.5">
            {creative.headlines?.[0] || 'Your Ad Headline Here'}
          </div>
          <div className="text-[15px] text-text-muted mt-0.5">
            {creative.descriptions?.[0] || 'A brief description goes here.'}
          </div>
        </div>
        <button className="px-4 py-1.5 bg-background border border-border rounded-lg text-[15px] font-semibold text-text-main hover:bg-border/50">
          {creative.callToAction || 'Learn More'}
        </button>
      </div>

      <div className="p-3 border-t border-border flex items-center justify-around text-text-muted font-medium text-[15px]">
        <div className="flex items-center gap-1.5 cursor-pointer hover:bg-background/50 py-1 px-3 rounded-lg"><ThumbsUp className="w-4 h-4" /> Like</div>
        <div className="flex items-center gap-1.5 cursor-pointer hover:bg-background/50 py-1 px-3 rounded-lg"><MessageSquare className="w-4 h-4" /> Comment</div>
        <div className="flex items-center gap-1.5 cursor-pointer hover:bg-background/50 py-1 px-3 rounded-lg"><Share2 className="w-4 h-4" /> Share</div>
      </div>
    </div>
  );
}

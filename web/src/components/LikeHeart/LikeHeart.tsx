// 「我喜欢」爱心：空心 = 未标记，实心 = 已标记，点一下切换并立即保存；只有图标，没有文字。
// 对整张专辑生效（所有副本共享）。状态靠形状（空心 / 实心）区分，另有 aria-pressed。放在专辑详情标题旁，不放在编辑表单里。
import {useApp} from '../../state/AppContext';
import {useAlbumFavorite} from './useAlbumFavorite';
import './LikeHeart.css';

const HEART = 'M12 20.5s-7.5-4.6-9.3-9.2C1.5 8 3.4 5 6.6 5c2 0 3.5 1.1 5.4 3.2C13.9 6.1 15.4 5 17.4 5c3.2 0 5.1 3 3.9 6.3-1.8 4.6-9.3 9.2-9.3 9.2z';

export function LikeHeart({id}: {id: string}) {
  const app = useApp();
  const fav = useAlbumFavorite(id, message => app.toast(message, 'err'));
  return <button type="button" className={`like-heart${fav.liked ? ' is-liked' : ''}`} aria-pressed={fav.liked}
    aria-label={fav.liked ? '取消我喜欢' : '标记为我喜欢'} title={fav.liked ? '取消我喜欢' : '我喜欢'}
    disabled={fav.loading} onClick={() => void fav.toggle()}>
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"
      fill={fav.liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round">
      <path d={HEART}/>
    </svg>
  </button>;
}

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useAlbumLikes} from '../hooks/useAlbumLikes';
import {useReducedMotion} from '../hooks/useReducedMotion';
import {useImmersive} from '../hooks/useImmersive';
import {useSessionState} from '../core/useSessionState';
import {useApp} from '../state/AppContext';
import {GALLERY_MODES, GALLERY_ROAMING_DEFAULTS, galleryIndex, galleryModeHasFocus, galleryRecords, isCollectedRecord, readGalleryPreferences, saveGalleryPreferences, showcaseGroups} from '../core/gallery';
import type {GalleryPreferences, GalleryScope, ShowcaseGroup} from '../core/gallery';
import {PageHead} from '../components/PageHead';
import {GalleryStage} from '../components/GalleryStage';
import {GalleryFocus} from '../components/GalleryFocus';
import {GalleryModePicker} from '../components/GalleryModePicker';
import {GalleryScopePicker} from '../components/GalleryScopePicker';
import {GalleryRoamingSwitch} from '../components/GalleryRoamingControls';
import {GallerySettings} from '../components/GallerySettings/GallerySettings';
import {ShowcaseSwitch, useShowcaseSwitch} from '../components/ShowcaseSwitch';
import {GearIcon} from '../components/ui/GearIcon';
import {ImmersiveDiag} from '../components/ImmersiveDiag';
import {openArtistDrawer} from '../forms/ArtistDrawer';
import {ShowcaseGroupForm} from '../forms/ShowcaseGroupForm';

export function GalleryPage() {
  const app = useApp();
  const switchOn = useShowcaseSwitch();
  const [preferences, setPreferences] = useState(readGalleryPreferences);
  const scope = preferences.scope;
  const [query, setQuery] = useSessionState<string>('gallery-query', '');
  const pageRef = useRef<HTMLDivElement>(null);
  const {immersive, chromeIdle, returning, enter: enterImmersive, exit: exitImmersive, probe} = useImmersive(pageRef, galleryModeHasFocus(preferences.mode) ? 'center' : 'top');

  const [roaming, setRoaming] = useState(false);
  const [focused, setFocused] = useState<{id: string; originElement: HTMLElement | null} | null>(null);
  const albumLikes = useAlbumLikes(app);
  const focusEntry = useRef(false);
  const focusClosing = useRef(false);
  const focusedRecord = focused ? app.rec(focused.id) : undefined;
  const reducedMotion = useReducedMotion();
  const groups = useMemo(() => showcaseGroups(app.state.settings), [app.state.settings]);
  const records = useMemo(() => galleryRecords(app.state.records, query, preferences.sort,
    preferences.scope, groups.groups, albumLikes.favorites),
    [app.state.records, query, preferences.sort, preferences.scope, groups.groups, albumLikes.favorites]);
  const currentId = records[galleryIndex(records, preferences.currentId)]?.id || null;
  const updatePreference = (patch: Partial<GalleryPreferences>) => setPreferences(p => ({...p, ...patch}));
  const pick = (id: string) => updatePreference({currentId: id});
  const modeLabel = GALLERY_MODES.find(m => m.value === preferences.mode)!.label;
  const roamingSeconds = preferences.roamingSpeeds[preferences.mode] ?? GALLERY_ROAMING_DEFAULTS[preferences.mode];
  const scopeLabel = scope.kind === 'favorites' ? '我喜欢' : scope.kind === 'artist' ? scope.artist
    : scope.kind === 'group' ? groups.groups.find(g => g.id === scope.groupId)?.name ?? '展示组'
      : '全部收藏';

  const openSettings = () => {
    app.openDrawer({title: '展示设置', compact: true, initialFocus: 'close',
      content: <GallerySettings mode={preferences.mode} inGroup={preferences.scope.kind === 'group'} roaming={roaming}
        discrete={galleryModeHasFocus(preferences.mode)}
        initial={{sort: preferences.sort === 'group' && preferences.scope.kind !== 'group' ? 'recent' : preferences.sort,
          density: preferences.density, spacing: preferences.spacing, axis: preferences.axis, showTitles: preferences.showTitles, seconds: roamingSeconds}}
        onChange={updatePreference}
        onSpeed={seconds => setPreferences(p => ({...p, roamingSpeeds: {...p.roamingSpeeds, [p.mode]: seconds}}))}/>,
    });
  };

  const chooseMode = () => {
    app.openDrawer({title: '选择展示方式', wide: true,
      content: <GalleryModePicker mode={preferences.mode} onSelect={mode => {
        updatePreference({mode}); app.closeDrawer();
      }}/>,
    });
  };

  const editGroup = (group?: ShowcaseGroup) => {
    app.openDrawer({title: group ? '编辑展示组' : '新建展示组', wide: true,
      content: <ShowcaseGroupForm group={group} store={groups} onSaved={id => {
        setQuery(''); updatePreference({scope: {kind: 'group', groupId: id}, sort: 'group'});
      }} onDeleted={id => setPreferences(p => p.scope.kind === 'group' && p.scope.groupId === id
        ? {...p, scope: {kind: 'all'}, sort: p.sort === 'group' ? 'recent' : p.sort} : p)}/>,
    });
  };
  const chooseScope = () => {
    app.openDrawer({title: '选择展示范围', compact: true, initialFocus: 'close',
      content: <GalleryScopePicker records={app.state.records} groups={groups.groups} scope={preferences.scope}
        favorites={albumLikes.favorites}
        onSelect={(scope: GalleryScope) => {
          updatePreference({scope, sort: scope.kind === 'group' ? 'group' : preferences.sort === 'group' ? 'recent' : preferences.sort});
          app.closeDrawer();
        }} onCreate={() => editGroup()} onEdit={editGroup}/>,
    });
  };

  useEffect(() => { saveGalleryPreferences(preferences); }, [preferences]);
  useEffect(() => {
    if (scope.kind === 'group' && !groups.groups.some(g => g.id === scope.groupId)) {
      setPreferences(p => ({...p, scope: {kind: 'all'}, sort: p.sort === 'group' ? 'recent' : p.sort}));
    }
  }, [groups.groups, scope]);

  // 数据刷新、筛选移除了当前副本时，只落到一张明确存在的结果。
  useEffect(() => {
    if (currentId && currentId !== preferences.currentId) setPreferences(p => ({...p, currentId}));
  }, [currentId, preferences.currentId]);

  const closeFocus = useCallback(() => {
    if (focusClosing.current) return;
    if (focusEntry.current && history.state?.obi === 'gallery-focus') {
      // The dialog has already completed its reverse zoom. Remove it now while
      // consuming its history entry, then block reopening until popstate settles.
      focusEntry.current = false; focusClosing.current = true; history.back();
    }
    setFocused(null);
  }, []);
  useEffect(() => {
    const popped = () => {
      if (!focusEntry.current) {focusClosing.current = false; return;}
      focusEntry.current = false; focusClosing.current = false;
      // Let the photo-style focus finish its reverse zoom before removing the dialog.
      window.dispatchEvent(new Event('gallery-focus-history-back'));
    };
    window.addEventListener('popstate', popped);
    return () => {
      window.removeEventListener('popstate', popped);
      if (focusEntry.current && !focusClosing.current && history.state?.obi === 'gallery-focus') history.back();
      focusEntry.current = false; focusClosing.current = false;
    };
  }, []);
  useEffect(() => {
    if (focused && (!focusedRecord || !isCollectedRecord(focusedRecord)
        || !records.some(r => r.id === focused.id))) closeFocus();
  }, [focused, focusedRecord, records, closeFocus]);
  const focus = (id: string, source?: HTMLElement) => {
    if (focusEntry.current || focusClosing.current) return;
    const originElement = source?.matches('.gallery-cover-button') ? source
      : source?.closest('.gallery-item')?.querySelector<HTMLElement>('.gallery-cover-button') ?? null;
    // Opening a cover pauses the track at its current pose; selecting here would
    // recenter looping layouts behind the dialog and change the return position.
    history.pushState({obi: 'gallery-focus'}, ''); focusEntry.current = true;
    setFocused({id, originElement});
  };
  const navigateFocus = (id: string) => {
    const next = records.find(record => record.id === id);
    if (!next || !focused) return;
    pick(id); setFocused({id, originElement: null});
  };

  return <div ref={pageRef} className={`gallery-page${immersive ? ' is-immersive' : ''}${immersive && chromeIdle ? ' is-chrome-idle' : ''}${returning ? ' is-returning' : ''}`}>
    {focused && focusedRecord ? <GalleryFocus record={focusedRecord} records={records} originElement={focused.originElement}
      onNavigate={navigateFocus} onClose={closeFocus}
      liked={Boolean(albumLikes.favorites[focusedRecord.id])}
      collectedAt={albumLikes.collectedAt[focusedRecord.id]}/> : null}
    {probe ? <ImmersiveDiag probe={probe}/> : null}
    <PageHead title={switchOn ? <><span className="head-title-text">收藏展示</span><span className="title-switch"><ShowcaseSwitch current="gallery"/></span></> : '收藏展示'} desc="把收藏铺开，慢慢看。"
              actions={<button type="button" className="quiet head-text" onClick={immersive ? exitImmersive : enterImmersive}>
                {immersive ? '退出沉浸' : '沉浸展示'}
              </button>}/>
    <div className="gallery-controls">
      <div className="gallery-filters">
        <div className="gallery-filter-inputs">
          <button type="button" className="gallery-scope-trigger" onClick={chooseScope} aria-haspopup="dialog"
                  aria-label={`展示范围：${scopeLabel}`} title={scopeLabel}>
            <span className="gallery-trigger-cap">范围</span><strong>{scopeLabel}</strong>
          </button>
          <label className="gallery-search"><span className="gallery-visually-hidden">搜索收藏</span>
            <input type="search" placeholder="搜索专辑或艺人" value={query} onChange={e => setQuery(e.target.value)}/>
          </label>
        </div>
        <div className="gallery-toolbar">
          <button type="button" className="gallery-mode-trigger" onClick={chooseMode} aria-haspopup="dialog"
                  aria-label={`展示方式：${modeLabel}`}>
            <span className="gallery-trigger-cap">方式</span><strong>{modeLabel}</strong>
          </button>
          <span className="gallery-count" role="status" aria-atomic="true"
                title={`${records.length} 张${query.trim() ? '匹配的' : ''}收藏`}>
            {records.length} 张<span className="gallery-visually-hidden">{query.trim() ? '匹配的收藏' : '收藏'}</span>
          </span>
          <button type="button" className="gallery-adjust-trigger" aria-haspopup="dialog" onClick={openSettings}>
            <GearIcon size={14}/>展示设置
          </button>
          <GalleryRoamingSwitch enabled={roaming} disabled={!records.length && !roaming} onToggle={() => setRoaming(v => !v)}/>
        </div>
      </div>
      {reducedMotion && roaming ? <span className="gallery-waterfall-note" role="status">减少动态效果已开启，巡游暂时暂停</span> : null}
    </div>
    {records.length ? <GalleryStage records={records} mode={preferences.mode} currentId={currentId}
      density={preferences.density} spacing={preferences.spacing} axis={preferences.axis} showTitles={preferences.showTitles} onPick={pick} onFocus={focus}
      roaming={roaming} roamingSpeed={roamingSeconds}
      onArtist={(artist, recordId) => {
        pick(recordId); openArtistDrawer(app, artist);
      }}/>
      : <div className="empty gallery-empty"><div className="empty-symbol">◫</div>
        <h3>{query.trim() ? '没有找到匹配的收藏' : scope.kind === 'favorites'
          ? '还没有喜欢的专辑' : '还没有可展示的收藏'}</h3>
        <p>{query.trim() ? '换个关键词，或看看全部收藏。' : scope.kind === 'favorites'
          ? '在专辑编辑页打开「我喜欢」，即可在这里集中展示。'
          : '收藏中的封面、照片与感想会出现在这里。'}</p>
        {query.trim() ? <button type="button" onClick={() => setQuery('')}>清除搜索</button>
          : scope.kind === 'favorites' ? <button type="button"
            onClick={() => updatePreference({scope: {kind: 'all'}})}>查看全部收藏</button>
          : <a className="link-button" href="#domestic">前往收藏</a>}
      </div>}
  </div>;
}

/* global fid, tid */
GM_addStyle(':root {--color1:#6E2B19;--color2:#FFEEBA;--color3:#FFF5D7;--color4:#DBC38C;} @@YamiboScript.css@@');
loadScriptMenu({
  '漫画阅读': {
    'Enable': true,
    '双页显示': true,
    '页面填充': true,
    '点击翻页': false,
    '阅读进度': true,
    '夜间模式': false
  },
  '记录阅读历史': {
    'Enable': true,
    '上次阅读进度标签颜色': '#6e2b19',
    '保留天数': -1
  },
  '体验优化': {
    'Enable': true,
    '关闭快捷导航的跳转': true,
    '修正点击页数时的跳转判定': true,
    '固定导航条': true
  },
  'Version': GM_info.script.version
});


if (ScriptMenu.UserSetting['体验优化']['关闭快捷导航的跳转'])
  document.querySelector('#qmenu a').setAttribute('href', 'javascript:;');
if (ScriptMenu.UserSetting['体验优化']['固定导航条'])
  document.getElementsByClassName('header-stackup')[0].style.position = 'fixed';

// 判断当前页是帖子
if (RegExp('thread(-\\d+){3}|mod=viewthread').test(document.URL)) {
  // 启用漫画阅读模式
  if (fid === 30 && ScriptMenu.UserSetting['漫画阅读'].Enable) {
    let List = [...document.querySelectorAll('.t_fsz img')],
        i = List.length;
    while (i--) {
      if (List[i].getAttribute('file'))
        List[i].setAttribute('src', List[i].getAttribute('file'));
      if (List[i].src.includes('static/image'))
        List.splice(i, 1);
      else if (List[i].getAttribute('src').indexOf('http') !== 0)
        List[i].setAttribute('src', `${location.protocol}//${location.host}/${List[i].getAttribute('src')}`);
    }

    let checkImgLoad = () => {
      let i = ComicReadWindow.comicImgList.length,
          tempImgList = ComicReadWindow.comicImgList;
      while (i--) {
        if (!tempImgList[i].complete)
          return false;
        else if (tempImgList[i].height < 500 && tempImgList[i].width < 500)
          ComicReadWindow.comicImgList.splice(i, 1);
      }
      return true;
    };

    appendDom(document.querySelector('div.pti > div.authi'), '<span class="pipe show">|</span><a id="comicReadMode" class="show" href="javascript:;">漫画阅读</a>');
    document.getElementById('comicReadMode').addEventListener('click', () =>{
      if (ComicReadWindow === undefined) {
        loadComicReadWindow({
          'comicImgList': [...document.querySelectorAll('.t_fsz img')],
          'readSetting': ScriptMenu.UserSetting['漫画阅读'],
          'EndExit': () => scrollTo(0, getTop(document.getElementsByClassName('psth').length ? document.getElementsByClassName('psth')[0] : [...document.querySelectorAll('.pcb>div:first-of-type')].find(e => e.clientHeight < 2000))),
          'comicName': document.getElementById('thread_subject').innerHTML
        });

        // 通过标签确定上/下一话
        if (document.querySelector('.ptg.mbm.mtn>a')) {
          let findNext = (pageNum) => {
            GM_xmlhttpRequest({
              method: 'GET',
              url: `https://bbs.yamibo.com/misc.php?mod=tag&id=${document.querySelector('.ptg.mbm.mtn>a').href.split('id=')[1]}&type=thread&page=${pageNum}`,
              onload: (data) => {
                let reg = /<th>\s<a href="thread-(\d+)(?=-)/g,
                    nowTid,
                    lastTid;
                while ((nowTid = reg.exec(data.responseText)) !== null) {
                  if (lastTid && +nowTid[1] === tid) {
                    ComicReadWindow.prevChapter = `thread-${lastTid}-1-1.html`;
                    ComicReadWindow.nextChapter = (nowTid = reg.exec(data.responseText)) !== null ? `${location.origin}/${nowTid[1]}` : null;
                    break;
                  } else
                    lastTid = nowTid[1];
                }
                if (!ComicReadWindow.prevChapter)
                  findNext(pageNum + 1);
              }
            });
          };
          findNext(1);
        }
      }
      if (checkImgLoad() || confirm('可能还有图片正在加载，请确认所有图片均已加载完毕'))
        ComicReadWindow.start();
    });
  }

  // 启用记录阅读进度
  if (ScriptMenu.UserSetting['记录阅读历史'].Enable) {
    let lastFloor;

    GM_xmlhttpRequest({
      method: 'GET',
      url: `https://bbs.yamibo.com/api/mobile/index.php?module=viewthread&tid=${tid}`,
      onload: (data) => {
        let json = JSON.parse(data.responseText);
        lastFloor = json.Variables.thread.allreplies;
      }
    });

    // 在关闭和切换标签页时重新储存数据
    document.addEventListener('visibilitychange', () => {
      if (!document.visible && document.body.style.overflow !== 'hidden') {
        let anchorList = [...document.querySelectorAll('[id^=pid]')],
            lTop = document.documentElement.scrollTop;
        while (getTop(anchorList[0]) < lTop)
          anchorList.shift();

        GM_setValue(tid, JSON.stringify({
          'page': document.querySelector('#pgt strong') ? document.querySelector('#pgt strong').innerHTML : '1',
          'lastFloor': lastFloor,
          'lastAnchor': anchorList[0].id,
          'time': new Date().getTime()
        }));
      }
    });
  }
}


// 判断当前页是板块
if (RegExp('forum(-\\d+){2}|mod=forumdisplay').test(document.URL)) {
  // 启用记录阅读进度
  if (ScriptMenu.UserSetting['记录阅读历史'].Enable) {
    GM_addStyle(`:root {--lastReadTagColor: ${ScriptMenu.UserSetting['记录阅读历史']['上次阅读进度标签颜色']}!important;}`);

    // 添加上次阅读进度提示标签
    let addLastReadTag = () => {
      if (document.getElementById('autopbn').text === '下一页 »') {
        let List = document.getElementsByClassName('lastReadTag'),
            i = List.length;
        while (i--)
          List[i].parentNode.removeChild(List[i]);

        List = document.querySelectorAll('tbody[id^=normalthread]');
        i = List.length;
        while (i--) {
          let tid = List[i].id.split('_')[1];
          if (GM_getValue(tid)) {
            let lastReadInfo = JSON.parse(GM_getValue(tid)),
                lastReplies = List[i].querySelector('.num a').innerHTML - lastReadInfo.lastFloor;
            appendDom(List[i].getElementsByTagName('th')[0], `
            <a href="thread-${tid}-${lastReadInfo.page}-1.html#${lastReadInfo.lastAnchor}"
             class="lastReadTag" onclick="atarget(this)">回第${lastReadInfo.page}页</a>
            ${lastReplies ? `<div class="lastReadTag">+${lastReplies}</div>` : ''}
          `);
          }
        }
      } else
        setTimeout(addLastReadTag, 100);
    };
    addLastReadTag();

    // 切换回当前页时重新添加提示标签
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden)
        addLastReadTag();
    });

    // 点击下一页后添加提示标签
    document.getElementById('autopbn').addEventListener('click', addLastReadTag);

    // 删除超过指定天数的阅读记录
    if (ScriptMenu.UserSetting['记录阅读历史']['保留天数'] !== -1) {
      const timeNum = new Date().getTime() - ScriptMenu.UserSetting['记录阅读历史']['保留天数'] * 24 * 60 * 60 * 1000;
      // 筛选出其记录的时间小于 timeNum 的 tid 的列表，逐一删除
      let List = GM_listValues().slice(0, -1),
          i = List.length;
      while (i--)
        if (GM_getValue(List[i]).split('"time":')[1] - 0 < timeNum)
          GM_deleteValue(List[i]);
    }
  }

  if (ScriptMenu.UserSetting['体验优化']['修正点击页数时的跳转判定']) {
    let List = document.querySelectorAll('.tps>a'),
        i = List.length;
    while (i--)
      List[i].setAttribute('onclick', 'atarget(this)');
  }

}

# 音声素材について（SE / BGM）

## 現状（リポジトリ同梱）

`public/assets/sounds/` および `public/assets/bgm/` には、開発用の**合成 WAV**（簡易トーン）を配置しています。
市販・無料素材サイトからの音源は同梱していません（利用規約・クレジット条件をアプリ作者側で確認して差し替えてください）。

| パス | 用途 |
|------|------|
| `/assets/sounds/discard.wav` | 打牌 |
| `/assets/sounds/pon.wav` | ポン |
| `/assets/sounds/chi.wav` | チー |
| `/assets/sounds/kan.wav` | カン |
| `/assets/sounds/riichi.wav` | リーチ |
| `/assets/sounds/tsumo.wav` | ツモ和了 |
| `/assets/sounds/ron.wav` | ロン和了 |
| `/assets/sounds/ryuukyoku.wav` | 流局 |
| `/assets/bgm/table-ambient.wav` | 対局 BGM（ループ） |

対局画面右上のシステム UI に「SE/BGM: 開発用合成音（差し替え可）」と小さく表示しています。

## 差し替え推奨サイト（ユーザー指定）

- 効果音: [DOVA-SYNDROME](https://dova-s.jp/)（麻雀専用 SE あり）、[TNO SITE 麻雀・カジノ系](https://tnosite.com/board-game_casino_mahjong_sound-effects-2/)
- BGM: [DOVA-SYNDROME](https://dova-s.jp/)

差し替え手順:

1. 各サイトの利用規約・クレジット表記の要否を確認する
2. 上記ファイル名で `public/assets/sounds/` / `public/assets/bgm/` に上書き配置（WAV / MP3 可。パスは `src/lib/audio/*.ts` を合わせて変更）
3. クレジットが必要な場合は、対局画面右上の注記またはフッター／設定に著作権表示を追記する

## 再生制御

- 部屋作成時のデフォルトおよび未設定の既存部屋は `se: false` / `bgm: false`（仮合成音が勝手に鳴らない）
- `rule_config` は対局開始時の初期値。対局画面右上のシステム UI から SE / BGM をいつでも手動 ON/OFF できる
- ブラウザの自動再生制限: 対局画面での最初のクリック／タップ（または「音声ON」）で解除
- 正規の BGM/SE 素材はライセンス確認済みのファイルを同梱するまで差し替えない（DOVA 等からの自動取得は行わない）

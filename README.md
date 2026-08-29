# Simple ScreenShot

[![CI](https://github.com/Aero123421/SimpleScreenShot/actions/workflows/ci.yml/badge.svg)](https://github.com/Aero123421/SimpleScreenShot/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/Aero123421/SimpleScreenShot)](https://github.com/Aero123421/SimpleScreenShot/releases/latest)
[![License](https://img.shields.io/badge/license-Apache--2.0%20OR%20GPL--3.0--or--later-blue)](LICENSE)

Ubuntu/GNOME向けの、Windows 11の切り取りツールに近い操作感を目指したスクリーンショット拡張です。Ubuntu 24.04 / GNOME Shell 46を対象にしています。

A Windows-style snipping overlay and annotation editor for Ubuntu 24.04 / GNOME Shell 46.

`Shift + Super + S`を押すと画面が静止し、上部に切り取りツールバーが表示されます。撮影した画像はクリップボードへコピーされ、プレビュー通知から注釈エディタを開けます。

## 機能

- 四角形、ウィンドウ、画面単位の切り取り
- マルチモニター対応
- 撮影時点の画面を固定して正確に切り取り
- PNGの自動保存とクリップボードコピー
- 撮影後のプレビュー通知
- ペン、蛍光ペン、矢印、四角形、文字、モザイク
- 非破壊クロップとUndo/Redo
- コピー、上書き保存、別名保存
- 最近の撮影履歴
- 保存先、ファイル名、押すだけで登録できるショートカット、マウスポインターなどの設定
- 日本語・英語UI

## 必要環境

- Ubuntu 24.04
- GNOME Shell 46
- GJS 1.80以降
- GTK 4.14以降
- Libadwaita 1.5以降

Ubuntu 24.04の標準デスクトップには通常すべて含まれています。

## インストール

次の1行で最新リリースをインストールできます。

```bash
curl -fsSL https://raw.githubusercontent.com/Aero123421/SimpleScreenShot/main/scripts/install-online.sh | sh
```

インストーラはGitHub Releaseから配布ZIPとSHA-256チェックサムを取得し、検証後にインストールします。スクリプトを先に確認する場合は[install-online.sh](scripts/install-online.sh)を開いてください。

バージョンを固定することもできます。

```bash
curl -fsSL https://raw.githubusercontent.com/Aero123421/SimpleScreenShot/main/scripts/install-online.sh | SIMPLE_SCREENSHOT_VERSION=v0.1.2 sh
```

新規インストール後は一度ログアウトしてログインしてください。X11では`Alt + F2`を押し、`r`を実行してGNOME Shellを再起動する方法もあります。

インストール後は次の方法で起動できます。

- `Shift + Super + S`
- トップパネルのカメラアイコン
- アプリ一覧の「Simple ScreenShot Editor」

設定画面はExtensionsアプリから「Simple ScreenShot」を選ぶか、トップパネルのカメラメニューから開きます。ショートカットは内部形式を入力する必要はなく、「Change…」を押して使いたいキーを実際に押すだけで変更できます。

## 撮影オーバーレイ

- `R`: 四角形の領域
- `W`: ウィンドウ
- `F`: 画面全体
- `Esc`: キャンセル

四角形モードではドラッグを離した時点で撮影します。ウィンドウまたは画面モードでは対象をクリックします。

## エディタ

- `Ctrl + Z`: 元に戻す
- `Ctrl + Y` / `Ctrl + Shift + Z`: やり直す
- `Ctrl + C`: 編集結果をコピー
- `Ctrl + S`: 上書き保存
- クロップ中の`Enter`: 適用
- クロップ中の`Esc`: キャンセル

モザイクは画像の該当範囲を実際に低解像度化してPNGへ合成します。クロップ、図形、ペンなどの操作は保存するまで元画像を変更しません。

## 開発

```bash
git clone https://github.com/Aero123421/SimpleScreenShot.git
cd SimpleScreenShot
make check
make run-editor
make pack
make install
```

`make check`はGSettingsスキーマ、全JavaScriptの構文、座標計算、GTK/CairoによるPNG出力、拡張パッケージ生成を検証します。

### 構成

```text
extension/
  extension.js       GNOME Shellとの統合
  overlay.js         Windows風の撮影オーバーレイ
  capture.js         compositor画像の切り出し・保存・履歴
  prefs.js           設定画面
  editor/            GTK4/Libadwaita注釈エディタ
scripts/             検査・インストール・アンインストール
tests/               座標計算とエディタ出力の検証
```

GNOME Shell内部で動く処理は撮影と通知に限定し、画像編集は別プロセスのGTKアプリで行います。エディタの不具合がGNOME Shell全体へ波及しない構成です。

## プライバシー

撮影画像、履歴、設定はすべてローカルに保存されます。テレメトリ、解析、クラウドアップロード機能はありません。ネットワーク通信を行うのはオンラインインストーラがGitHub Releaseを取得するときだけです。

## コントリビューション

不具合報告や機能提案は[GitHub Issues](https://github.com/Aero123421/SimpleScreenShot/issues)へお願いします。開発への参加方法は[CONTRIBUTING.md](CONTRIBUTING.md)を参照してください。

## ライセンス

利用者は次のいずれかを選択できます。

- [Apache License 2.0](LICENSE-APACHE)
- [GNU GPL 3.0 or later](LICENSE-GPL)

SPDX表記は`Apache-2.0 OR GPL-3.0-or-later`です。GNOME Shell拡張として再配布する場合は、GNOME Shellとのライセンス互換性を満たすGPL-3.0-or-laterを選択できます。

## 現在の対象範囲

GNOME Shellの内部APIはメジャーバージョン間で変更されるため、現時点ではGNOME 46のみをサポート対象にしています。GNOME 47以降へは各バージョンでの実機確認後に`metadata.json`の対応バージョンを追加します。

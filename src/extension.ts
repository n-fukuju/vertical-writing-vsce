'use strict';
// VSCode拡張のAPIを含むモジュール
import * as vscode from 'vscode';

// 拡張がアクティブ化されたタイミングで実行されるメソッド。
// 拡張は、コマンドが実行されたときにアクティブ化される。
export function activate(context: vscode.ExtensionContext)
{
    console.log("vertical-writing-vsce:: activate()")
    // コマンドを登録（※ package.json の、activationEvents, commands と合わせること）
    context.subscriptions.push(vscode.commands.registerCommand("extension.vertical", async()=>{
        console.log("vertical-writing-vsce:: extension.vertical.");
        PreviewPanel.show(context.extensionUri);
    }));
    // エディタ側の変更時に、プレビューに反映
    vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent)=>{
        if(e.document == vscode.window.activeTextEditor?.document){ PreviewPanel.update(); }
    });
    vscode.window.onDidChangeTextEditorSelection((e: vscode.TextEditorSelectionChangeEvent)=>{
        if(e.textEditor == vscode.window.activeTextEditor){ PreviewPanel.update(); }
    });
    
    // if(vscode.window.registerWebviewPanelSerializer)
    // {
    //     vscode.window.registerWebviewPanelSerializer(PreviewPanel.viewType, {
    //         async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any){
    //             console.log(`vertical-writing-vsce:: deserialize: state: ${state}`);
    //             PreviewPanel.revive(webviewPanel, context.extensionUri, vscode.window.activeTextEditor);
    //         }
    //     });
    // }
}

/** プレビューパネルのクラス */
class PreviewPanel{
    public static currentPanel: PreviewPanel | undefined;
    public static readonly viewType = 'vertical';
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _editor?: vscode.TextEditor;
    private _disposables: vscode.Disposable[] = [];

    /** 表示する */
    public static show(extensionUri: vscode.Uri)
    {
        const column = vscode.window.activeTextEditor
            // ? vscode.window.activeTextEditor.viewColumn: undefined;
            ? vscode.ViewColumn.Two: undefined;
        const editor = vscode.window.activeTextEditor;
        
        // パネルが存在する場合
        if(PreviewPanel.currentPanel){
            PreviewPanel.currentPanel._panel.reveal(column);
            return;
        }
        // パネルを作成
        const panel = vscode.window.createWebviewPanel(
            PreviewPanel.viewType,
            '縦書きプレビュー',
            column || vscode.ViewColumn.Two,
            { enableScripts: true }
        );
        PreviewPanel.currentPanel = new PreviewPanel(panel, extensionUri, editor);
    }

    public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, editor?: vscode.TextEditor)
    {
        PreviewPanel.currentPanel = new PreviewPanel(panel, extensionUri, editor);
    }

    /** コンストラクタ */
    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, editor?: vscode.TextEditor)
    {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._editor = editor;

        // コンテンツの初期化
        this._update();


        // dispose
        this._panel.onDidDispose(()=> this.dispose(), null, this._disposables);

        // 変更
        this._panel.onDidChangeViewState(
            e => {
                if(this._panel.visible){ this._update(); }
            },
            null, this._disposables
        );

        // webviewのメッセージを処理
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch(message.command){
                    case 'alert':
                        vscode.window.showErrorMessage(message.text);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public dispose()
    {
        PreviewPanel.currentPanel = undefined;
        this._panel.dispose();
        while(this._disposables.length){
            const x = this._disposables.pop();
            if(x){ x.dispose(); }
        }
    }

    public static update()
    {
        if(this.currentPanel){ this.currentPanel._update(); }
    }

    private _update()
    {
        // const webview = this._panel.webview;
        // this._panel.webview.html = this._getHtmlForWebview(webview)
        this._panel.title = "preview";
        
        // テキストを取得
        let offset = this._editor? this._editor.document.offsetAt(this._editor.selection.anchor): 0;
        let text = this._editor? this._editor.document.getText(): "";

        // 更新
        const config = vscode.workspace.getConfiguration('vertical');
        let symbol = config.get<string>('cursor.symbol');
        let position = config.get<string>('cursor.position');
        let fontsize = config.get<string>('preview.fontsize');
        let fontfamily = config.get<string>('preview.fontfamily');
        this._panel.webview.html = this._getHtmlForWebview(text, offset, (symbol?symbol:'|'), (position?position:'inner'), (fontsize?fontsize:'14px'), (fontfamily?fontfamily:''));
    }

    /** WebViewに表示するHTMLを返す */
    private _getHtmlForWebview(text:string, offset:number, cursor: string, position: string, fontsize: string, fontfamily: string)
    {
        // エディタのカーソル位置に、カーソル記号を差し込む
        let text2 = text.slice(0, offset) + '<span id="cursor">' + cursor + '</span>' + text.slice(offset);
        // 改行文字で分割する
        let para = '';
        for(let paragraph of text2.split('\n'))
        {
            if(!/^\s+$/.test(paragraph))
            {
                para += '<p>' + paragraph + '</p>';
            }
            else
            {
                // 空白行（スタイルシートで透明化する）
                para += '<p class=blank>_</p>'
            }
        }
        return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <style>
        div#content{
            /* 縦書きモード*/
            writing-mode: vertical-rl;
            width: 100%;
            margin: 5px;
            overflow:auto;
        }
        p{
            text-indent: 1em;
            font-size: ${fontsize};
            font-family: "${fontfamily}";
            margin:0;
            padding:0;
        }
        p.blank{
            color:rgba(255,255,255,0);
        }
    </style>
</head>
<body>
    <div id="content">${para}</div>
    <script>
            // カーソルを点滅させる
            var visible = true;
            var cursor = document.getElementById("cursor");
            function Toggle(){
                if(visible){
                    cursor.style.visibility = "visible";
                }else{
                    cursor.style.visibility = "hidden";
                }
                visible = !visible;
                setTimeout(Toggle, 500);
            }
            Toggle();

            
            window.onload = function(){
                var cursor_position = '${position}';
                var content = document.getElementById("content");
                var cursor = document.getElementById("cursor");
                var rect = cursor.getBoundingClientRect();
                // デバッグ用出力
                if(false){
                    console.log("*** debug ***");
                    // カーソル位置設定
                    console.log("pos: "+ cursor_position);
                    // カーソル座標、要素の幅
                    console.log("rect.left: " + rect.left);
                    console.log("rect.width: " + rect.width);
                    // スクロール範囲、スクロール範囲内でのスクロール座標、内部幅
                    console.log("content.scrollWidth: " + content.scrollWidth);
                    console.log("content.scrollLeft: " + content.scrollLeft);
                    console.log("content.clientWidth: " + content.clientWidth);
                    // ウインドウ内部幅
                    console.log("window.innerWidth: " + window.innerWidth);

                    // Element.getBoundingClientRect() は、表示領域の左上が(0,0)
                    //  => カーソルが表示領域より左にあれば、マイナス値になる。
                    // Element.scrollLeft は、スクロール範囲の左上が(0,0)
                    //  => VSCodeエディタ側での文字入力やカーソル移動といった更新タイミングで、プレビューを更新している。
                    //  => onload時点でのスクロール位置は縦書きの文書先頭である、右上。（要素幅分だけ左側にずれる）
                    //  => ↓ の処理で、ユーザ任意の位置にスクロールする。
                }

                // スクロール位置の保存（'none', 'inner' のみ）
                if(cursor_position != 'right' &&
                   cursor_position != 'center' &&
                   cursor_position != 'left')
                {
                    var tick = false;
                    var scrollLeft = 0;
                    content.addEventListener('scroll', function(e)
                    {
                        scrollLeft = content.scrollLeft;
                        if(!tick)
                        {
                            // 再描画のタイミングで、スクロール位置を保存する。
                            window.requestAnimationFrame(function()
                            {
                                // console.log('scrollLeft saving: ' + scrollLeft);
                                localStorage.setItem('scrollLeft', scrollLeft);
                                // console.log('scrollLeft saved : ' + localStorage.getItem('scrollLeft'));
                                tick = false;
                            })
                            tick = true;
                        }
                    });
                }

                // 表示領域をカーソル位置にスクロールする
                if(cursor_position == 'right')
                {
                    // カーソル位置は表示範囲の右端に固定
                    var left = content.scrollLeft - (-rect.left) - content.clientWidth;
                    content.scrollLeft = left;
                }
                else if(cursor_position == 'center')
                {
                    // カーソル位置は表示範囲の中央に固定
                    var left = content.scrollLeft - (-rect.left) -rect.width - content.clientWidth  + window.innerWidth/2;
                    content.scrollLeft = left;
                }
                else if(cursor_position == 'left')
                {
                    // カーソル位置は表示範囲の左端に固定
                    var left = content.scrollLeft - (-rect.left) - rect.width*3 - content.clientWidth + window.innerWidth;
                    content.scrollLeft = left;
                }
                else if(cursor_position == 'none')
                {
                    // 前回と同じスクロール位置に移動する
                    var prevLeft = localStorage.getItem('scrollLeft');
                    if(prevLeft){ content.scrollLeft = prevLeft; }
                }
                else
                {
                    // 前回と同じスクロール位置に移動する
                    var prevLeft = localStorage.getItem('scrollLeft');
                    if(prevLeft){ content.scrollLeft = prevLeft; }

                    // 表示範囲から外れていれば補正する
                    rect = cursor.getBoundingClientRect();
                    // console.log("rect2.left: " + rect.left);
                    if(rect.left < rect.width/2)
                    {
                        content.scrollLeft -= (rect.width - rect.left);
                    }
                    if(rect.left > content.clientWidth)
                    {
                        content.scrollLeft += (rect.left - content.clientWidth);
                    }
                }
            };
    </script>
</body>
</html>
`
    }
}

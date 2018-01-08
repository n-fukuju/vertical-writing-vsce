'use strict';
// VSCode拡張のAPIを含むモジュール
import * as vscode from 'vscode';

// 拡張がアクティブ化されたタイミングで実行されるメソッド。
// 拡張は、コマンドが実行されたときにアクティブ化される。
export function activate(context: vscode.ExtensionContext) {

    // ここはアクティブ化された際に一度だけ実行される。
    console.log('Congratulations, your extension "hello" is now active!');

    // TextDocumentContentProvider（読み取り専用ドキュメント）で、プレビューを実装する。
    let previewUri = vscode.Uri.parse('text-preview://authority/text-preview');
    class TextDocumentContentProvider implements vscode.TextDocumentContentProvider{
        private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
        public provideTextDocumentContent(uri: vscode.Uri): string{
            return this.createContent();
        }
        
        get onDidChange(): vscode.Event<vscode.Uri>{return this._onDidChange.event}
        public update(uri: vscode.Uri){this._onDidChange.fire(uri);}
        // プレビューの内容を構築する。
        public createContent(){
            let editor = vscode.window.activeTextEditor;
            //if(!(editor.document.languageId==='css')){}
            return this.extractContent();
        }
        private extractContent(): string{
            let editor = vscode.window.activeTextEditor;
            let text = editor.document.getText();
            let offset = editor.document.offsetAt(editor.selection.anchor);
            // 設定を取得する。
            const config = vscode.workspace.getConfiguration('vertical');
            return this.content(editor.document, offset, config.get('cursor'), config.get('cursor.position'), config.get('preview.fontsize'), config.get('preview.fontfamily'));
        }
        private content(document: vscode.TextDocument, offset: number, cursor: string, position: string, fontsize: string, fontfamily: string): string{
            let para = '';
            let text = document.getText();
            // カーソル位置に記号を差し込む
            let text2 = text.slice(0, offset) + '<span id="cursor">' + cursor + '</span>' + text.slice(offset);
            // 改行文字で分割する
            for(let paragraph of text2.split('\n')){
                if(!/^\s+$/.test(paragraph))
                {
                    para += '<p>' + paragraph + '</p>';
                }
                else
                {
                    // 空白行（スタイルシートで透明化）
                    para += '<p class=blank>_</p>';
                }
            }
            return `<style>
                        div#content{
                            /* 縦書きモード */
                            writing-mode: vertical-rl;
                            width: 100%;
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
                    </body>`;
        }
    }
    let provider = new TextDocumentContentProvider();
    let registration = vscode.workspace.registerTextDocumentContentProvider('text-preview', provider);
    vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent)=>{
        if(e.document === vscode.window.activeTextEditor.document){provider.update(previewUri);}
    });
    vscode.window.onDidChangeTextEditorSelection((e: vscode.TextEditorSelectionChangeEvent)=>{
        if(e.textEditor === vscode.window.activeTextEditor){provider.update(previewUri);}
    });
    
    // registerCommand() で、コマンドの実装を登録する。
    // コマンドID引数（第一引数）は、package.json の、command フィールドと一致する必要がある。
    let disposable = vscode.commands.registerCommand('extension.vertical', ()=>{
        return vscode.commands.executeCommand('vscode.previewHtml', previewUri, vscode.ViewColumn.Two, '縦書きプレビュー').then((success)=>{
        },(reason)=>{
            vscode.window.showErrorMessage(reason);
        });
    });
    context.subscriptions.push(disposable);


}

// 非アクティブ化
export function deactivate() {
}

let s:path = fnamemodify(resolve(expand('<sfile>:p')), ':h')
:function s:run(fi)
:	silent execute "!" . s:path . "/nipplerun.sh " . a:fi
:endfunction
:autocmd BufWritePost <buffer> :call s:run(expand('<afile>'))
set autoread
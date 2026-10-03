create or replace function public.bn_epayco_detail_read(p_reference text, p_bearer text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare h extensions.http_response; j jsonb; d jsonb; l jsonb; output jsonb;
begin
 if p_reference is null or p_reference !~ '^[1-9][0-9]{0,13}$' or p_bearer is null or length(p_bearer)>8192 or p_bearer !~ '^Bearer [A-Za-z0-9._~+/=-]+$' then raise exception using message='INVALID_PROVIDER_LOOKUP'; end if;
 -- Fixed destination/method. The short-lived bearer is not persisted or returned.
 perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS','3000');
 perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','9000');
 h := extensions.http(row('GET','https://apify.epayco.co/transaction/detail',array[extensions.http_header('Authorization',p_bearer),extensions.http_header('Accept','application/json')],'application/json',jsonb_build_object('filter',jsonb_build_object('referencePayco',p_reference::bigint))::text)::extensions.http_request);
 perform extensions.http_reset_curlopt();
 if h.status <> 200 then return jsonb_build_object('_http',h.status,'success',false,'lookupError',case when h.status in (401,403) then 'PROVIDER_AUTH_OR_PERMISSION' else 'PROVIDER_HTTP_ERROR' end); end if;
 if h.content is null or length(h.content)>1048576 then return jsonb_build_object('_http',h.status,'success',false,'lookupError','PROVIDER_BODY_INVALID'); end if;
 begin j:=h.content::jsonb; exception when others then return jsonb_build_object('success',false,'lookupError','PROVIDER_JSON_INVALID'); end;
 d:=j->'data'; l:=d->'log';
 output:=jsonb_build_object('_http',h.status,'success',j->'success','titleResponse',left(j->>'titleResponse',160),'textResponse',left(j->>'textResponse',200),'lastAction',left(j->>'lastAction',100),'_shape',jsonb_build_object('dataType',jsonb_typeof(d),'logType',jsonb_typeof(l),'dataKeys',case when jsonb_typeof(d)='object' then (select jsonb_agg(key) from jsonb_object_keys(d) key) else '[]'::jsonb end));
 -- Only verification fields; no card details, payer data or callback signature.
 if jsonb_typeof(d)='object' then
  output:=output || jsonb_build_object('data',(select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) from jsonb_each(d) where key in ('referencePayco','amount','status','test','bill','currency')) || jsonb_build_object('log',case when jsonb_typeof(l)='object' then (select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) from jsonb_each(l) where key in ('x_ref_payco','x_cust_id_cliente','x_transaction_id','x_id_invoice','x_id_factura','x_amount','x_currency_code','x_test_request','x_response','x_respuesta')) else null end));
 end if;
 return output;
exception when others then
 perform extensions.http_reset_curlopt();
 -- Never propagate SQLERRM: request headers must not reach clients or logs.
 return jsonb_build_object('success',false,'lookupError','PROVIDER_LOOKUP_UNAVAILABLE');
end $$;
revoke all on function public.bn_epayco_detail_read(text,text) from public,anon,authenticated;
grant execute on function public.bn_epayco_detail_read(text,text) to service_role;
comment on function public.bn_epayco_detail_read(text,text) is 'Fixed read-only ePayco detail endpoint; service_role only; preserves GET JSON body; never returns credentials or payer data.';

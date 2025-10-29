// address-suggest.js
// Единственная экспортируемая функция:
// addressSuggest(api_key_suggest, api_key_geocode, ll, spn, delivery_fc, input_field_id, debug, callbackOnGeocodeValidate)
// - ll: "lon,lat"
// - spn: "dx,dy"
// - delivery_fc: GeoJSON FeatureCollection (полигоны зон доставки)
// - input_field_id: id поля ввода (без #)
// - debug: true/false
// - callbackOnGeocodeValidate: function({ ok, ll:{lon,lat} | null, text, reason }) — вызывается после геокода/валидации

(function(root, factory){
    if (typeof module === 'object' && module.exports) {
      module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
      define([], factory);
    } else {
      root.addressSuggest = factory();
    }
  }(typeof self !== 'undefined' ? self : this, function(){
  
    // one-time CSS injector for awesomplete tweaks and close button
    var _addrSuggestStylesInjected = false;
    function injectAddressSuggestStyles(){
      if (_addrSuggestStylesInjected) return;
      try {
        var css = ''+
          '.awesomplete > ul, .awesomplete > ul > li{animation:none!important;transition:none!important;}' +
          '.awesomplete__close{position:absolute;top:6px;right:6px;width:32px;height:32px;line-height:22px;border-radius:14px;border:3px solid rgba(0,0,0,0.15);background:#fff;color:#333;text-align:center;font-weight:bold;cursor:pointer;z-index:2;box-shadow:0 1px 3px rgba(0,0,0,0.1);}' +
          '.awesomplete__close:active{transform:scale(0.98);}';
        var st = document.createElement('style');
        st.type = 'text/css';
        st.appendChild(document.createTextNode(css));
        (document.head || document.documentElement).appendChild(st);
      } catch(_) {}
      _addrSuggestStylesInjected = true;
    }

    function addressSuggest(api_key_suggest, api_key_geocode, ll, spn, delivery_fc, input_field_id, debug, maxItems, callbackOnGeocodeValidate){
      var input = null;
      if (typeof input_field_id === 'string') {
        input = document.getElementById(input_field_id);
      } else if (input_field_id && input_field_id.nodeType === 1) {
        input = input_field_id;
      }
      if (!input) throw new Error('addressSuggest: input element not found');
      if (typeof Awesomplete === 'undefined') throw new Error('addressSuggest: Awesomplete is required');
      injectAddressSuggestStyles();
  
      // state
      var selectedLL = null;
      var lastGeocodedText = '';
      var geocodePending = false;
      if (typeof callbackOnGeocodeValidate !== 'function') throw new Error('addressSuggest: callbackOnGeocodeValidate must be a function');
  
      // utils
      function log(){ if (debug) try { console.log.apply(console, arguments); } catch(_){} }
      function debounce(fn, ms){ var t; return function(){ var a=arguments,th=this; clearTimeout(t); t=setTimeout(function(){ fn.apply(th,a); }, ms||250); }; }
      function esc(s){ return (''+s).replace(/[&<>"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]); }); }
      function markHL(text, hl){
        if (!text) return '';
        if (!hl || !hl.length) return esc(text);
        var out = '', i = 0, r = hl.slice().sort(function(a,b){ return a.begin - b.begin; });
        for (var k=0;k<r.length;k++){
          var b = r[k].begin|0, e = r[k].end|0;
          if (b>i) out += esc(text.slice(i,b));
          out += '<mark>'+esc(text.slice(b,e))+'</mark>';
          i = e;
        }
        if (i<text.length) out += esc(text.slice(i));
        return out || esc(text);
      }
  
      // point-in-polygon for FeatureCollection
      function pointInFeatureCollection(lon, lat, fc){
        if (!fc || fc.type !== 'FeatureCollection' || !fc.features) return false;
        for (var i=0;i<fc.features.length;i++){
          var f = fc.features[i];
          if (!f || !f.geometry) continue;
          var g = f.geometry;
          if (g.type === 'Polygon'){
            if (pipInRings([lon,lat], g.coordinates)) return true;
          } else if (g.type === 'MultiPolygon'){
            var polys = g.coordinates || [];
            for (var p=0;p<polys.length;p++){
              if (pipInRings([lon,lat], polys[p])) return true;
            }
          } else {
            // ignore Points/Lines
          }
        }
        return false;
      }
      function pipInRings(pt, rings){
        if (!rings || !rings.length) return false;
        var inside = rayCast(pt, rings[0]);
        if (inside && rings.length > 1){
          for (var i=1;i<rings.length;i++){
            if (rayCast(pt, rings[i])) return false;
          }
        }
        return inside;
      }
      function rayCast(pt, ring){
        var x = pt[0], y = pt[1], inside = false;
        for (var i=0, j=ring.length-1; i<ring.length; j=i++){
          var xi = ring[i][0], yi = ring[i][1];
          var xj = ring[j][0], yj = ring[j][1];
          var intersect = ((yi>y) !== (yj>y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi);
          if (intersect) inside = !inside;
        }
        return inside;
      }
  
      // Awesomplete init
      var ac = new Awesomplete(input, {
        minChars: 0,
        autoFirst: false,
        maxItems: maxItems,
        replace: function(sug){
          var v = sug.value;
          var label = (v && v.title && v.title.text) ? v.title.text : (sug.label || '');
          // Сборка «читаемого» адреса из компонентов, если есть
          try{
            if (v && v.address && Array.isArray(v.address.component)) {
              var comp = v.address.component;
              var parts = [];
              for (var i=1;i<comp.length;i++){ // пропустим первый (обычно страна/регион)
                if (comp[i] && comp[i].name) parts.push(comp[i].name);
              }
              // Если это business — добавим название
              if (Array.isArray(v.tags) && v.tags[0] === 'business' && v.title && v.title.text){
                parts.push(v.title.text);
              }
              label = parts.join(', ') || label;
            }
          } catch(_) {}
          this.input.value = label;
          // try { onInput({ target: this.input }); } catch(_) {}
        },
        filter: function(){ return true; },
        sort: false,
        item: function(sug){
          var v = sug.value || {};
          var title = v.title && v.title.text ? v.title.text : (sug.label || '');
          var titleHL = v.title && v.title.hl ? v.title.hl : [];
          var sub = v.subtitle && v.subtitle.text ? v.subtitle.text : '';
          var subHL = v.subtitle && v.subtitle.hl ? v.subtitle.hl : [];
          var html = '<strong>' + markHL(title, titleHL) + '</strong>' + (sub ? '<br><small>' + markHL(sub, subHL) + '</small>' : '');
          var li = document.createElement('li'); li.innerHTML = html; return li;
        },
        data: function(item){
          var label = item && item.title && item.title.text ? item.title.text : '';
          return { label: label, value: item };
        }
      });
      // Close button logic for mobile usability
      function ensureCloseBtn(){
        if (!ac || !ac.ul) return null;
        var existing = ac.ul.querySelector('.awesomplete__close');
        if (existing) return existing;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'awesomplete__close';
        btn.setAttribute('aria-label', 'Закрыть подсказки');
        btn.textContent = '×';
        btn.addEventListener('click', function(e){
          try { ac.close(); } catch(_) {}
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
          return false;
        });
        ac.ul.appendChild(btn);
        return btn;
      }

  
      // SUGGEST
      function fetchSuggest(q, done){
        var url = 'https://suggest-maps.yandex.ru/v1/suggest'
          + '?apikey=' + encodeURIComponent(api_key_suggest)
          + '&text='   + encodeURIComponent(q)
          + '&lang=ru_RU'
          + '&types='  + encodeURIComponent('geo,biz')
          + '&results=' + encodeURIComponent(maxItems)
          + '&strict_bounds=1'
          + '&print_address=1'
          + '&attrs=uri'
          + '&spn='   + encodeURIComponent(spn)
          + '&ll='    + encodeURIComponent(ll);
        log('fetchSuggest:', url);
        fetch(url).then(function(r){ return r.json(); }).then(function(j){
          var arr = j && (j.results || j.suggestions) || [];
          done(arr);
        }).catch(function(err){ log('suggest error', err); done([]); });
      }
  
      // GEOCODE
      function geocodeOnce(geocode, done){
        var url = 'https://geocode-maps.yandex.ru/v1'
          + '?apikey=' + encodeURIComponent(api_key_geocode)
          + '&format=json'
          + '&lang=ru_RU'
          + '&rspn=1'
          + '&ll=' + encodeURIComponent(ll)
          + '&spn=' + encodeURIComponent(spn)
          + '&geocode=' + encodeURIComponent(geocode);
        log('geocodeOnce:', geocode);
        fetch(url).then(function(r){ return r.json(); }).then(function(j){
          try{
            var pos  = j.response.GeoObjectCollection.featureMember[0].GeoObject.Point.pos; // "lon lat"
            var sp = pos.split(' ');
            var lon = parseFloat(sp[0]), lat = parseFloat(sp[1]);
            if (!isNaN(lon) && !isNaN(lat)) { done({lon:lon, lat:lat}); return; }
          }catch(e){}
          done(null);
        }).catch(function(err){ log('geocode error', err); done(null); });
      }
  
      // Show/evaluate suggestions if needed
      function showSuggestionsIfNeeded(){
        var q = input.value.trim();
        if (q.length >= 3) {
          if (ac.list && ac.list.length > 0) {
            ac.evaluate();
          } else {
            fetchSuggest(q, function(items){
              ac.list = items || [];
              ac.evaluate();
            });
          }
        }
      }
  
      // Finish input → geocode → validate
      function finishInputAndValidate(reason){
        var text = (input.value || '').trim();
        if (text.length < 3) {
          log('callbackOnGeocodeValidate:', { ok:false, ll:null, text:text, reason: 'short' });
          callbackOnGeocodeValidate({ ok:false, ll:null, text:text, reason: 'short' });
          return;
        }
        if (geocodePending || text === lastGeocodedText) return;
        geocodePending = true;
  
        geocodeOnce(text, function(llobj){
          geocodePending = false;
          if (!llobj){
            log('callbackOnGeocodeValidate:', { ok:false, ll:null, text:text, reason: 'geocode_fail' });
            callbackOnGeocodeValidate({ ok:false, ll:null, text:text, reason: 'geocode_fail' });
            return;
          }
          selectedLL = llobj;
          lastGeocodedText = text;
  
          var ok = pointInFeatureCollection(llobj.lon, llobj.lat, delivery_fc);
          log('callbackOnGeocodeValidate:', { ok: ok, ll: llobj, text: text, reason: reason || 'done' });
          callbackOnGeocodeValidate({ ok: ok, ll: llobj, text: text, reason: reason || 'done' });
        });
      }
  
      // Events
      var onFocus = function(){ if (input.value.trim().length>=3) ac.evaluate(); };
      var onInput = debounce(function(e){
        var q = e.target.value.trim();
        if (q.length < 3) { ac.list = []; return; }
        fetchSuggest(q, function(items){ ac.list = items || []; ac.evaluate(); });
      }, 150);
      var onSelect = function(){ finishInputAndValidate('select'); };
      var onKeyDown = function(e){
        if (e.key === 'Enter'){
          finishInputAndValidate('enter');
        }
      };
      var onClick = function(){ showSuggestionsIfNeeded(); };
      var onBlur = function(){ finishInputAndValidate('blur'); };
  
      input.addEventListener('focus', onFocus);
      input.addEventListener('input', onInput);
      input.addEventListener('awesomplete-selectcomplete', onSelect);
      input.addEventListener('keydown', onKeyDown);
      input.addEventListener('click', onClick);
      input.addEventListener('blur', onBlur);

      // Manage close button on open/close
      input.addEventListener('awesomplete-open', function(){ try { ensureCloseBtn(); } catch(_){} });
  
      // public controller
      return {
        getSelectedLL: function(){ return selectedLL; },
        setDeliveryFeatureCollection: function(fc){ delivery_fc = fc; },
        destroy: function(){
          input.removeEventListener('focus', onFocus);
          input.removeEventListener('input', onInput);
          input.removeEventListener('awesomplete-selectcomplete', onSelect);
          input.removeEventListener('keydown', onKeyDown);
          input.removeEventListener('click', onClick);
          input.removeEventListener('blur', onBlur);
        }
      };
    }
  
    return addressSuggest;
  }));
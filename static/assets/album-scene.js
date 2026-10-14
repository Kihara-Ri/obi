var ro=Object.defineProperty;var ao=(e,n,t)=>n in e?ro(e,n,{enumerable:!0,configurable:!0,writable:!0,value:t}):e[n]=t;var Re=(e,n,t)=>ao(e,typeof n!="symbol"?n+"":n,t);import{U as Ot,c as oo,N as Gt,S as Pt,C as Ve,R as so,e as nt,w as Xe,V as xt,l as zi,M as Et,F as fa,W as Xi,a as Lt,b as it,L as $t,H as zt,D as Bt,B as At,d as vn,f as me,p as co,g as Nn,h as Sn,i as et,j as Tn,O as Pi,P as mn,k as $n,m as un,n as Ki,o as lo,q as fo,A as Rn,r as uo,s as po,t as ho,u as mo,v as _o,x as go,y as vo,z as So,E as xo,G as Eo,I as Mo,J as To,K as Ao,Q as Ro,Z as bo,T as da,X as Kn,Y as qn,_ as Vn,$ as vt,a0 as Dn,a1 as ua,a2 as Vt,a3 as Co,a4 as wo,a5 as Li,a6 as Po,a7 as Di,a8 as Lo,a9 as Do,aa as Uo,ab as yo,ac as Io,ad as Xt,ae as mt,af as nn,ag as kn,ah as No,ai as Wt,aj as Un,ak as xn,al as Yn,am as jt,an as En,ao as Fo,ap as on,aq as qi,ar as Oo,as as Je,at as Bo,au as Go,av as ni,aw as kt,ax as pn,ay as Fn,az as Ho,aA as Vo,aB as jn,aC as Dt,aD as ko,aE as dn,aF as Oe,aG as Wo,aH as pa,aI as ha,aJ as ma,aK as Zn,aL as _a,aM as ga,aN as zo,aO as Xo,aP as Ko,aQ as qo,aR as Yo,aS as Zo,aT as $o,aU as jo,aV as Yi,aW as Qo,aX as Wn,aY as Jo,aZ as Zi,a_ as $i,a$ as ji,b0 as es,b1 as Qi,b2 as ts,b3 as Si,b4 as va,b5 as Sa,b6 as xa,b7 as ns,b8 as Ea,b9 as is,ba as rs,bb as as,bc as os,bd as Ma,be as ss,bf as cs,bg as ls,bh as ii,bi as ri,bj as ai,bk as oi,bl as Ji,bm as er,bn as tr,bo as nr,bp as ir,bq as rr,br as ar,bs as or,bt as sr,bu as xi,bv as cr,bw as lr,bx as fr,by as dr,bz as ur,bA as pr,bB as hr,bC as mr,bD as _r,bE as gr,bF as vr,bG as Sr,bH as xr,bI as Er,bJ as Mr,bK as Tr,bL as Ar,bM as Rr,bN as br,bO as Cr,bP as Ei,bQ as wr,bR as Ta,bS as Pr,bT as Aa,bU as Lr,bV as Tt,bW as fs,bX as Ra,bY as ba,bZ as Ca,b_ as Ui,b$ as wa,c0 as Pa,c1 as La,c2 as si,c3 as ci,c4 as ds,c5 as us,c6 as ps,c7 as hs,c8 as ms,c9 as _s,ca as gs,cb as Mi,cc as vs,cd as Ss,ce as xs,cf as Es,cg as Ti,ch as Da,ci as Ms,cj as In,ck as Ua,cl as Rt,cm as Ts,cn as ya,co as Ia,cp as Na,cq as tn,cr as Dr,cs as yi,ct as As,cu as Rs,cv as bs,cw as Cs,cx as li,cy as ws,cz as Mn,cA as Ps,cB as Ls,cC as Ds,cD as Us,cE as ys,cF as Is,cG as rn,cH as _n,cI as Ns,cJ as Fs,cK as Os,cL as Bs,cM as Fa,cN as Gs,cO as Ur,cP as yr,cQ as Ir,cR as Hs,cS as an,cT as Vs,cU as Oa,cV as ks,cW as Ws,cX as Ba,cY as Ga,cZ as zs,c_ as zn,c$ as Xs,d0 as Ks,d1 as Nr,d2 as Fr,d3 as qs,d4 as Ys,d5 as bn,d6 as Zs,d7 as $s,d8 as Cn,d9 as js,da as Qs,db as Js,dc as ec,dd as tc,de as nc}from"./index.js";/**
 * @license
 * Copyright 2010-2026 Three.js Authors
 * SPDX-License-Identifier: MIT
 */function Ha(){let e=null,n=!1,t=null,i=null;function r(a,o){i=e.requestAnimationFrame(r),t(a,o)}return{start:function(){n!==!0&&t!==null&&e!==null&&(i=e.requestAnimationFrame(r),n=!0)},stop:function(){e!==null&&e.cancelAnimationFrame(i),n=!1},setAnimationLoop:function(a){t=a},setContext:function(a){e=a}}}function ic(e){const n=new WeakMap;function t(s,c){const d=s.array,g=s.usage,_=d.byteLength,p=e.createBuffer();e.bindBuffer(c,p),e.bufferData(c,d,g),s.onUploadCallback();let v;if(d instanceof Float32Array)v=e.FLOAT;else if(typeof Float16Array<"u"&&d instanceof Float16Array)v=e.HALF_FLOAT;else if(d instanceof Uint16Array)s.isFloat16BufferAttribute?v=e.HALF_FLOAT:v=e.UNSIGNED_SHORT;else if(d instanceof Int16Array)v=e.SHORT;else if(d instanceof Uint32Array)v=e.UNSIGNED_INT;else if(d instanceof Int32Array)v=e.INT;else if(d instanceof Int8Array)v=e.BYTE;else if(d instanceof Uint8Array)v=e.UNSIGNED_BYTE;else if(d instanceof Uint8ClampedArray)v=e.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+d);return{buffer:p,type:v,bytesPerElement:d.BYTES_PER_ELEMENT,version:s.version,size:_}}function i(s,c,d){const g=c.array,_=c.updateRanges;if(e.bindBuffer(d,s),_.length===0)e.bufferSubData(d,0,g);else{_.sort((v,R)=>v.start-R.start);let p=0;for(let v=1;v<_.length;v++){const R=_[p],E=_[v];E.start<=R.start+R.count+1?R.count=Math.max(R.count,E.start+E.count-R.start):(++p,_[p]=E)}_.length=p+1;for(let v=0,R=_.length;v<R;v++){const E=_[v];e.bufferSubData(d,E.start*g.BYTES_PER_ELEMENT,g,E.start,E.count)}c.clearUpdateRanges()}c.onUploadCallback()}function r(s){return s.isInterleavedBufferAttribute&&(s=s.data),n.get(s)}function a(s){s.isInterleavedBufferAttribute&&(s=s.data);const c=n.get(s);c&&(e.deleteBuffer(c.buffer),n.delete(s))}function o(s,c){if(s.isInterleavedBufferAttribute&&(s=s.data),s.isGLBufferAttribute){const g=n.get(s);(!g||g.version<s.version)&&n.set(s,{buffer:s.buffer,type:s.type,bytesPerElement:s.elementSize,version:s.version});return}const d=n.get(s);if(d===void 0)n.set(s,t(s,c));else if(d.version<s.version){if(d.size!==s.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(d.buffer,s,c),d.version=s.version}}return{get:r,remove:a,update:o}}var rc=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,ac=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,oc=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,sc=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,cc=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,lc=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,fc=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,dc=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,uc=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,pc=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,hc=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,mc=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,_c=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,gc=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,vc=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Sc=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,xc=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Ec=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Mc=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Tc=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Ac=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Rc=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,bc=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,Cc=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,wc=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Pc=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,Lc=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Dc=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Uc=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,yc=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Ic="gl_FragColor = linearToOutputTexel( gl_FragColor );",Nc=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Fc=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,Oc=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,Bc=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,Gc=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Hc=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,Vc=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,kc=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Wc=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,zc=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Xc=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,Kc=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,qc=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Yc=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Zc=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_SUN_LIGHTS > 0
	struct SunLight {
		vec3 direction;
		vec3 color;
	};
	uniform SunLight sunLights[ NUM_SUN_LIGHTS ];
	void getSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {
		light.color = sunLight.color;
		light.direction = sunLight.direction;
		light.visible = true;
	}
#endif
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,$c=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_RETROREFLECTION
		vec3 getIBLRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 retroVec = normalize( mix( viewDir, normal, pow4( roughness ) ) );
				retroVec = transformDirectionByInverseViewMatrix( retroVec, viewMatrix );
				vec4 envMapColor = textureCubeUV( envMap, envMapRotation * retroVec, roughness );
				return envMapColor.rgb * envMapIntensity;
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
		#ifdef USE_RETROREFLECTION
			vec3 getIBLAnisotropyRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
				#ifdef ENVMAP_TYPE_CUBE_UV
					vec3 bentNormal = cross( bitangent, viewDir );
					bentNormal = normalize( cross( bentNormal, bitangent ) );
					bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
					return getIBLRetroRadiance( viewDir, bentNormal, roughness );
				#else
					return vec3( 0.0 );
				#endif
			}
		#endif
	#endif
#endif`,jc=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Qc=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Jc=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,el=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,tl=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_RETROREFLECTION
	material.retroreflectivity = retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,nl=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	vec2 dfg;
	vec3 multiScatteringCompensation;
	#ifdef USE_RETROREFLECTION
		float retroreflectivity;
	#endif
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0Dielectric;
		vec3 iridescenceF0Metallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec2 fab, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	#ifdef USE_RETROREFLECTION
		vec3 retroViewDir = reflect( - geometryViewDir, geometryNormal );
		vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );
		specularBRDF = mix( specularBRDF, retroSpecularBRDF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float dotVH = saturate( dot( geometryViewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
	#ifdef USE_RETROREFLECTION
		vec3 retroHalfDir = normalize( directLight.direction + retroViewDir );
		float dotRetroVH = saturate( dot( retroViewDir, retroHalfDir ) );
		vec3 retroF = F_Schlick( material.specularColor, material.specularF90, dotRetroVH );
		F = mix( F, retroF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScattering, multiScattering );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );
	#endif
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		sheenSpecularIndirect += irradiance * material.sheenColor * sheenAlbedo * RECIPROCAL_PI;
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( material.dfg, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceF0Metallic, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,il=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		vec3 iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		vec3 iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( iridescenceFresnelDielectric, iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0Dielectric = Schlick_to_F0( iridescenceFresnelDielectric, 1.0, dotNVi );
		material.iridescenceF0Metallic = Schlick_to_F0( iridescenceFresnelMetallic, 1.0, dotNVi );
	}
#endif
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )
	SunLight sunLight;
	#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {
		sunLight = sunLights[ i ];
		getSunLightInfo( sunLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
		sunLightShadow = sunLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,rl=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_RETROREFLECTION
		#ifdef USE_ANISOTROPY
			vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
		#else
			vec3 retroIBLRadiance = getIBLRetroRadiance( geometryViewDir, geometryNormal, material.roughness );
		#endif
		iblRadiance = mix( iblRadiance, retroIBLRadiance, saturate( material.retroreflectivity ) );
	#endif
	radiance += iblRadiance;
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,al=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,ol=`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,sl=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,cl=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,ll=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,fl=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,dl=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,ul=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,pl=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,hl=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,ml=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,_l=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,gl=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,vl=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Sl=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,xl=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,El=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Ml=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Tl=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Al=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Rl=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,bl=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,Cl=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,wl=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Pl=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Ll=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Dl=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Ul=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,yl=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,Il=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Nl=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Fl=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Ol=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Bl=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Gl=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Hl=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		#define SUN_LIGHT_CASCADES 2
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#else
			uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#endif
		uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		uniform vec4 sunShadowCascade[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
		struct SunLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SunLightShadow sunLightShadows[ NUM_SUN_LIGHT_SHADOWS ];
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_SUN_LIGHT_SHADOWS > 0
		float getSunShadow(
			#if defined( SHADOWMAP_TYPE_PCF )
				sampler2DShadow shadowMap,
			#else
				sampler2D shadowMap,
			#endif
			SunLightShadow sunLightShadow,
			int shadowIndex
		) {
			vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );
			float viewDepth = vSunShadowWorldPosition.w;
			int cascadeOffset = shadowIndex * SUN_LIGHT_CASCADES;
			float shadow = 1.0;
			for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- ) {
				vec4 cascade = sunShadowCascade[ cascadeOffset + i ];
				if ( viewDepth >= cascade.x && viewDepth < cascade.y ) {
					float cascadeShadow = getShadow(
						shadowMap,
						sunLightShadow.shadowMapSize,
						sunLightShadow.shadowIntensity,
						sunLightShadow.shadowBias,
						sunLightShadow.shadowRadius,
						sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition
					);
					shadow = mix( cascadeShadow, shadow, smoothstep( cascade.z, cascade.y, viewDepth ) );
				}
			}
			return shadow;
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,Vl=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,kl=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_SUN_LIGHT_SHADOWS > 0
		vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );
		vSunShadowWorldNormal = shadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,Wl=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHT_SHADOWS; i ++ ) {
		sunLight = sunLightShadows[ i ];
		shadow *= receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLight, UNROLLED_LOOP_INDEX ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,zl=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Xl=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,Kl=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,ql=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,Yl=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Zl=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,$l=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,jl=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,Ql=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,Jl=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,ef=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,tf=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,nf=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,rf=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const af=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,of=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,sf=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,cf=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,lf=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,ff=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,df=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,uf=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,pf=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,hf=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,mf=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,_f=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,gf=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,vf=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Sf=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,xf=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Ef=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Mf=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Tf=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Af=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Rf=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,bf=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Cf=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,wf=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Pf=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,Lf=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_RETROREFLECTION
	uniform float retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Df=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Uf=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,yf=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,If=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Nf=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Ff=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Of=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Bf=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Le={alphahash_fragment:rc,alphahash_pars_fragment:ac,alphamap_fragment:oc,alphamap_pars_fragment:sc,alphatest_fragment:cc,alphatest_pars_fragment:lc,aomap_fragment:fc,aomap_pars_fragment:dc,batching_pars_vertex:uc,batching_vertex:pc,begin_vertex:hc,beginnormal_vertex:mc,bsdfs:_c,iridescence_fragment:gc,bumpmap_pars_fragment:vc,clipping_planes_fragment:Sc,clipping_planes_pars_fragment:xc,clipping_planes_pars_vertex:Ec,clipping_planes_vertex:Mc,color_fragment:Tc,color_pars_fragment:Ac,color_pars_vertex:Rc,color_vertex:bc,common:Cc,cube_uv_reflection_fragment:wc,defaultnormal_vertex:Pc,displacementmap_pars_vertex:Lc,displacementmap_vertex:Dc,emissivemap_fragment:Uc,emissivemap_pars_fragment:yc,colorspace_fragment:Ic,colorspace_pars_fragment:Nc,envmap_fragment:Fc,envmap_common_pars_fragment:Oc,envmap_pars_fragment:Bc,envmap_pars_vertex:Gc,envmap_physical_pars_fragment:$c,envmap_vertex:Hc,fog_vertex:Vc,fog_pars_vertex:kc,fog_fragment:Wc,fog_pars_fragment:zc,gradientmap_pars_fragment:Xc,lightmap_pars_fragment:Kc,lights_lambert_fragment:qc,lights_lambert_pars_fragment:Yc,lights_pars_begin:Zc,lights_toon_fragment:jc,lights_toon_pars_fragment:Qc,lights_phong_fragment:Jc,lights_phong_pars_fragment:el,lights_physical_fragment:tl,lights_physical_pars_fragment:nl,lights_fragment_begin:il,lights_fragment_maps:rl,lights_fragment_end:al,lightprobes_pars_fragment:ol,logdepthbuf_fragment:sl,logdepthbuf_pars_fragment:cl,logdepthbuf_pars_vertex:ll,logdepthbuf_vertex:fl,map_fragment:dl,map_pars_fragment:ul,map_particle_fragment:pl,map_particle_pars_fragment:hl,metalnessmap_fragment:ml,metalnessmap_pars_fragment:_l,morphinstance_vertex:gl,morphcolor_vertex:vl,morphnormal_vertex:Sl,morphtarget_pars_vertex:xl,morphtarget_vertex:El,normal_fragment_begin:Ml,normal_fragment_maps:Tl,normal_pars_fragment:Al,normal_pars_vertex:Rl,normal_vertex:bl,normalmap_pars_fragment:Cl,clearcoat_normal_fragment_begin:wl,clearcoat_normal_fragment_maps:Pl,clearcoat_pars_fragment:Ll,iridescence_pars_fragment:Dl,opaque_fragment:Ul,packing:yl,premultiplied_alpha_fragment:Il,project_vertex:Nl,dithering_fragment:Fl,dithering_pars_fragment:Ol,roughnessmap_fragment:Bl,roughnessmap_pars_fragment:Gl,shadowmap_pars_fragment:Hl,shadowmap_pars_vertex:Vl,shadowmap_vertex:kl,shadowmask_pars_fragment:Wl,skinbase_vertex:zl,skinning_pars_vertex:Xl,skinning_vertex:Kl,skinnormal_vertex:ql,specularmap_fragment:Yl,specularmap_pars_fragment:Zl,tonemapping_fragment:$l,tonemapping_pars_fragment:jl,transmission_fragment:Ql,transmission_pars_fragment:Jl,uv_pars_fragment:ef,uv_pars_vertex:tf,uv_vertex:nf,worldpos_vertex:rf,background_vert:af,background_frag:of,backgroundCube_vert:sf,backgroundCube_frag:cf,cube_vert:lf,cube_frag:ff,depth_vert:df,depth_frag:uf,distance_vert:pf,distance_frag:hf,equirect_vert:mf,equirect_frag:_f,linedashed_vert:gf,linedashed_frag:vf,meshbasic_vert:Sf,meshbasic_frag:xf,meshlambert_vert:Ef,meshlambert_frag:Mf,meshmatcap_vert:Tf,meshmatcap_frag:Af,meshnormal_vert:Rf,meshnormal_frag:bf,meshphong_vert:Cf,meshphong_frag:wf,meshphysical_vert:Pf,meshphysical_frag:Lf,meshtoon_vert:Df,meshtoon_frag:Uf,points_vert:yf,points_frag:If,shadow_vert:Nf,shadow_frag:Ff,sprite_vert:Of,sprite_frag:Bf},le={common:{diffuse:{value:new Ve(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Oe},alphaMap:{value:null},alphaMapTransform:{value:new Oe},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Oe}},envmap:{envMap:{value:null},envMapRotation:{value:new Oe},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Oe}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Oe}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Oe},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Oe},normalScale:{value:new mt(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Oe},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Oe}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Oe}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Oe}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Ve(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new me},probesMax:{value:new me},probesResolution:{value:new me}},points:{diffuse:{value:new Ve(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Oe},alphaTest:{value:0},uvTransform:{value:new Oe}},sprite:{diffuse:{value:new Ve(16777215)},opacity:{value:1},center:{value:new mt(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Oe},alphaMap:{value:null},alphaMapTransform:{value:new Oe},alphaTest:{value:0}}},Ft={basic:{uniforms:Tt([le.common,le.specularmap,le.envmap,le.aomap,le.lightmap,le.fog]),vertexShader:Le.meshbasic_vert,fragmentShader:Le.meshbasic_frag},lambert:{uniforms:Tt([le.common,le.specularmap,le.envmap,le.aomap,le.lightmap,le.emissivemap,le.bumpmap,le.normalmap,le.displacementmap,le.fog,le.lights,{emissive:{value:new Ve(0)},envMapIntensity:{value:1}}]),vertexShader:Le.meshlambert_vert,fragmentShader:Le.meshlambert_frag},phong:{uniforms:Tt([le.common,le.specularmap,le.envmap,le.aomap,le.lightmap,le.emissivemap,le.bumpmap,le.normalmap,le.displacementmap,le.fog,le.lights,{emissive:{value:new Ve(0)},specular:{value:new Ve(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Le.meshphong_vert,fragmentShader:Le.meshphong_frag},standard:{uniforms:Tt([le.common,le.envmap,le.aomap,le.lightmap,le.emissivemap,le.bumpmap,le.normalmap,le.displacementmap,le.roughnessmap,le.metalnessmap,le.fog,le.lights,{emissive:{value:new Ve(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Le.meshphysical_vert,fragmentShader:Le.meshphysical_frag},toon:{uniforms:Tt([le.common,le.aomap,le.lightmap,le.emissivemap,le.bumpmap,le.normalmap,le.displacementmap,le.gradientmap,le.fog,le.lights,{emissive:{value:new Ve(0)}}]),vertexShader:Le.meshtoon_vert,fragmentShader:Le.meshtoon_frag},matcap:{uniforms:Tt([le.common,le.bumpmap,le.normalmap,le.displacementmap,le.fog,{matcap:{value:null}}]),vertexShader:Le.meshmatcap_vert,fragmentShader:Le.meshmatcap_frag},points:{uniforms:Tt([le.points,le.fog]),vertexShader:Le.points_vert,fragmentShader:Le.points_frag},dashed:{uniforms:Tt([le.common,le.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Le.linedashed_vert,fragmentShader:Le.linedashed_frag},depth:{uniforms:Tt([le.common,le.displacementmap]),vertexShader:Le.depth_vert,fragmentShader:Le.depth_frag},normal:{uniforms:Tt([le.common,le.bumpmap,le.normalmap,le.displacementmap,{opacity:{value:1}}]),vertexShader:Le.meshnormal_vert,fragmentShader:Le.meshnormal_frag},sprite:{uniforms:Tt([le.sprite,le.fog]),vertexShader:Le.sprite_vert,fragmentShader:Le.sprite_frag},background:{uniforms:{uvTransform:{value:new Oe},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Le.background_vert,fragmentShader:Le.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Oe}},vertexShader:Le.backgroundCube_vert,fragmentShader:Le.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Le.cube_vert,fragmentShader:Le.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Le.equirect_vert,fragmentShader:Le.equirect_frag},distance:{uniforms:Tt([le.common,le.displacementmap,{referencePosition:{value:new me},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Le.distance_vert,fragmentShader:Le.distance_frag},shadow:{uniforms:Tt([le.lights,le.fog,{color:{value:new Ve(0)},opacity:{value:1}}]),vertexShader:Le.shadow_vert,fragmentShader:Le.shadow_frag}};Ft.physical={uniforms:Tt([Ft.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Oe},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Oe},clearcoatNormalScale:{value:new mt(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Oe},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Oe},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Oe},sheen:{value:0},sheenColor:{value:new Ve(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Oe},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Oe},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Oe},transmissionSamplerSize:{value:new mt},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Oe},attenuationDistance:{value:0},attenuationColor:{value:new Ve(0)},specularColor:{value:new Ve(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Oe},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Oe},anisotropyVector:{value:new mt},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Oe}}]),vertexShader:Le.meshphysical_vert,fragmentShader:Le.meshphysical_frag};const Gn={r:0,b:0,g:0},Gf=new Et,Va=new Oe;Va.set(-1,0,0,0,1,0,0,0,1);function Hf(e,n,t,i,r,a){const o=new Ve(0);let s=r===!0?0:1,c,d,g=null,_=0,p=null;function v(b){let D=b.isScene===!0?b.background:null;if(D&&D.isTexture){const S=b.backgroundBlurriness>0;D=n.get(D,S)}return D}function R(b){let D=!1;const S=v(b);S===null?u(o,s):S&&S.isColor&&(u(S,1),D=!0);const A=e.xr.getEnvironmentBlendMode();A==="additive"?t.buffers.color.setClear(0,0,0,1,a):A==="alpha-blend"&&t.buffers.color.setClear(0,0,0,0,a),(e.autoClear||D)&&(t.buffers.depth.setTest(!0),t.buffers.depth.setMask(!0),t.buffers.color.setMask(!0),e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil))}function E(b,D){const S=v(D);S&&(S.isCubeTexture||S.mapping===jn)?(d===void 0&&(d=new et(new $n(1,1,1),new Xt({name:"BackgroundCubeMaterial",uniforms:Si(Ft.backgroundCube.uniforms),vertexShader:Ft.backgroundCube.vertexShader,fragmentShader:Ft.backgroundCube.fragmentShader,side:At,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),d.geometry.deleteAttribute("normal"),d.geometry.deleteAttribute("uv"),d.onBeforeRender=function(A,M,C){this.matrixWorld.copyPosition(C.matrixWorld)},Object.defineProperty(d.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(d)),d.material.uniforms.envMap.value=S,d.material.uniforms.backgroundBlurriness.value=D.backgroundBlurriness,d.material.uniforms.backgroundIntensity.value=D.backgroundIntensity,d.material.uniforms.backgroundRotation.value.setFromMatrix4(Gf.makeRotationFromEuler(D.backgroundRotation)).transpose(),S.isCubeTexture&&S.isRenderTargetTexture===!1&&d.material.uniforms.backgroundRotation.value.premultiply(Va),d.material.toneMapped=it.getTransfer(S.colorSpace)!==Je,(g!==S||_!==S.version||p!==e.toneMapping)&&(d.material.needsUpdate=!0,g=S,_=S.version,p=e.toneMapping),d.layers.enableAll(),b.unshift(d,d.geometry,d.material,0,0,null)):S&&S.isTexture&&(c===void 0&&(c=new et(new va(2,2),new Xt({name:"BackgroundMaterial",uniforms:Si(Ft.background.uniforms),vertexShader:Ft.background.vertexShader,fragmentShader:Ft.background.fragmentShader,side:vn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(c)),c.material.uniforms.t2D.value=S,c.material.uniforms.backgroundIntensity.value=D.backgroundIntensity,c.material.toneMapped=it.getTransfer(S.colorSpace)!==Je,S.matrixAutoUpdate===!0&&S.updateMatrix(),c.material.uniforms.uvTransform.value.copy(S.matrix),(g!==S||_!==S.version||p!==e.toneMapping)&&(c.material.needsUpdate=!0,g=S,_=S.version,p=e.toneMapping),c.layers.enableAll(),b.unshift(c,c.geometry,c.material,0,0,null))}function u(b,D){b.getRGB(Gn,Sa(e)),t.buffers.color.setClear(Gn.r,Gn.g,Gn.b,D,a)}function f(){d!==void 0&&(d.geometry.dispose(),d.material.dispose(),d=void 0),c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0)}return{getClearColor:function(){return o},setClearColor:function(b,D=1){o.set(b),s=D,u(o,s)},getClearAlpha:function(){return s},setClearAlpha:function(b){s=b,u(o,s)},render:R,addToRenderList:E,dispose:f}}function Vf(e,n){const t=e.getParameter(e.MAX_VERTEX_ATTRIBS),i={},r=p(null);let a=r,o=!1;function s(N,B,V,I,X){let Z=!1;const Y=_(N,I,V,B);a!==Y&&(a=Y,d(a.object)),Z=v(N,I,V,X),Z&&R(N,I,V,X),X!==null&&n.update(X,e.ELEMENT_ARRAY_BUFFER),(Z||o)&&(o=!1,S(N,B,V,I),X!==null&&e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,n.get(X).buffer))}function c(){return e.createVertexArray()}function d(N){return e.bindVertexArray(N)}function g(N){return e.deleteVertexArray(N)}function _(N,B,V,I){const X=I.wireframe===!0;let Z=i[B.id];Z===void 0&&(Z={},i[B.id]=Z);const Y=N.isInstancedMesh===!0?N.id:0;let te=Z[Y];te===void 0&&(te={},Z[Y]=te);let $=te[V.id];$===void 0&&($={},te[V.id]=$);let J=$[X];return J===void 0&&(J=p(c()),$[X]=J),J}function p(N){const B=[],V=[],I=[];for(let X=0;X<t;X++)B[X]=0,V[X]=0,I[X]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:B,enabledAttributes:V,attributeDivisors:I,object:N,attributes:{},index:null}}function v(N,B,V,I){const X=a.attributes,Z=B.attributes;let Y=0;const te=V.getAttributes();for(const $ in te)if(te[$].location>=0){const ee=X[$];let we=Z[$];if(we===void 0&&($==="instanceMatrix"&&N.instanceMatrix&&(we=N.instanceMatrix),$==="instanceColor"&&N.instanceColor&&(we=N.instanceColor)),ee===void 0||ee.attribute!==we||we&&ee.data!==we.data)return!0;Y++}return a.attributesNum!==Y||a.index!==I}function R(N,B,V,I){const X={},Z=B.attributes;let Y=0;const te=V.getAttributes();for(const $ in te)if(te[$].location>=0){let ee=Z[$];ee===void 0&&($==="instanceMatrix"&&N.instanceMatrix&&(ee=N.instanceMatrix),$==="instanceColor"&&N.instanceColor&&(ee=N.instanceColor));const we={};we.attribute=ee,ee&&ee.data&&(we.data=ee.data),X[$]=we,Y++}a.attributes=X,a.attributesNum=Y,a.index=I}function E(){const N=a.newAttributes;for(let B=0,V=N.length;B<V;B++)N[B]=0}function u(N){f(N,0)}function f(N,B){const V=a.newAttributes,I=a.enabledAttributes,X=a.attributeDivisors;V[N]=1,I[N]===0&&(e.enableVertexAttribArray(N),I[N]=1),X[N]!==B&&(e.vertexAttribDivisor(N,B),X[N]=B)}function b(){const N=a.newAttributes,B=a.enabledAttributes;for(let V=0,I=B.length;V<I;V++)B[V]!==N[V]&&(e.disableVertexAttribArray(V),B[V]=0)}function D(N,B,V,I,X,Z,Y){Y===!0?e.vertexAttribIPointer(N,B,V,X,Z):e.vertexAttribPointer(N,B,V,I,X,Z)}function S(N,B,V,I){E();const X=I.attributes,Z=V.getAttributes(),Y=B.defaultAttributeValues;for(const te in Z){const $=Z[te];if($.location>=0){let J=X[te];if(J===void 0&&(te==="instanceMatrix"&&N.instanceMatrix&&(J=N.instanceMatrix),te==="instanceColor"&&N.instanceColor&&(J=N.instanceColor)),J!==void 0){const ee=J.normalized,we=J.itemSize,Ce=n.get(J);if(Ce===void 0)continue;const ot=Ce.buffer,Ke=Ce.type,qe=Ce.bytesPerElement,z=Ke===e.INT||Ke===e.UNSIGNED_INT||J.gpuType===Ma;if(J.isInterleavedBufferAttribute){const j=J.data,Ee=j.stride,Ue=J.offset;if(j.isInstancedInterleavedBuffer){for(let _e=0;_e<$.locationSize;_e++)f($.location+_e,j.meshPerAttribute);N.isInstancedMesh!==!0&&I._maxInstanceCount===void 0&&(I._maxInstanceCount=j.meshPerAttribute*j.count)}else for(let _e=0;_e<$.locationSize;_e++)u($.location+_e);e.bindBuffer(e.ARRAY_BUFFER,ot);for(let _e=0;_e<$.locationSize;_e++)D($.location+_e,we/$.locationSize,Ke,ee,Ee*qe,(Ue+we/$.locationSize*_e)*qe,z)}else{if(J.isInstancedBufferAttribute){for(let j=0;j<$.locationSize;j++)f($.location+j,J.meshPerAttribute);N.isInstancedMesh!==!0&&I._maxInstanceCount===void 0&&(I._maxInstanceCount=J.meshPerAttribute*J.count)}else for(let j=0;j<$.locationSize;j++)u($.location+j);e.bindBuffer(e.ARRAY_BUFFER,ot);for(let j=0;j<$.locationSize;j++)D($.location+j,we/$.locationSize,Ke,ee,we*qe,we/$.locationSize*j*qe,z)}}else if(Y!==void 0){const ee=Y[te];if(ee!==void 0)switch(ee.length){case 2:e.vertexAttrib2fv($.location,ee);break;case 3:e.vertexAttrib3fv($.location,ee);break;case 4:e.vertexAttrib4fv($.location,ee);break;default:e.vertexAttrib1fv($.location,ee)}}}}b()}function A(){T();for(const N in i){const B=i[N];for(const V in B){const I=B[V];for(const X in I){const Z=I[X];for(const Y in Z)g(Z[Y].object),delete Z[Y];delete I[X]}}delete i[N]}}function M(N){if(i[N.id]===void 0)return;const B=i[N.id];for(const V in B){const I=B[V];for(const X in I){const Z=I[X];for(const Y in Z)g(Z[Y].object),delete Z[Y];delete I[X]}}delete i[N.id]}function C(N){for(const B in i){const V=i[B];for(const I in V){const X=V[I];if(X[N.id]===void 0)continue;const Z=X[N.id];for(const Y in Z)g(Z[Y].object),delete Z[Y];delete X[N.id]}}}function m(N){for(const B in i){const V=i[B],I=N.isInstancedMesh===!0?N.id:0,X=V[I];if(X!==void 0){for(const Z in X){const Y=X[Z];for(const te in Y)g(Y[te].object),delete Y[te];delete X[Z]}delete V[I],Object.keys(V).length===0&&delete i[B]}}}function T(){U(),o=!0,a!==r&&(a=r,d(a.object))}function U(){r.geometry=null,r.program=null,r.wireframe=!1}return{setup:s,reset:T,resetDefaultState:U,dispose:A,releaseStatesOfGeometry:M,releaseStatesOfObject:m,releaseStatesOfProgram:C,initAttributes:E,enableAttribute:u,disableUnusedAttributes:b}}function kf(e,n,t){let i;function r(c){i=c}function a(c,d){e.drawArrays(i,c,d),t.update(d,i,1)}function o(c,d,g){g!==0&&(e.drawArraysInstanced(i,c,d,g),t.update(d,i,g))}function s(c,d,g){if(g===0)return;n.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,c,0,d,0,g);let p=0;for(let v=0;v<g;v++)p+=d[v];t.update(p,i,1)}this.setMode=r,this.render=a,this.renderInstances=o,this.renderMultiDraw=s}function Wf(e,n,t,i){let r;function a(){if(r!==void 0)return r;if(n.has("EXT_texture_filter_anisotropic")===!0){const C=n.get("EXT_texture_filter_anisotropic");r=e.getParameter(C.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else r=0;return r}function o(C){return!(C!==kt&&i.convert(C)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_FORMAT))}function s(C){const m=C===zt&&(n.has("EXT_color_buffer_half_float")||n.has("EXT_color_buffer_float"));return!(C!==Ot&&C!==jt&&!m&&i.convert(C)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_TYPE))}function c(C){if(C==="highp"){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT).precision>0)return"highp";C="mediump"}return C==="mediump"&&e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let d=t.precision!==void 0?t.precision:"highp";const g=c(d);g!==d&&(Xe("WebGLRenderer:",d,"not supported, using",g,"instead."),d=g);const _=t.logarithmicDepthBuffer===!0,p=t.reversedDepthBuffer===!0&&n.has("EXT_clip_control");t.reversedDepthBuffer===!0&&p===!1&&Xe("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");const v=e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS),R=e.getParameter(e.MAX_VERTEX_TEXTURE_IMAGE_UNITS),E=e.getParameter(e.MAX_TEXTURE_SIZE),u=e.getParameter(e.MAX_CUBE_MAP_TEXTURE_SIZE),f=e.getParameter(e.MAX_VERTEX_ATTRIBS),b=e.getParameter(e.MAX_VERTEX_UNIFORM_VECTORS),D=e.getParameter(e.MAX_VARYING_VECTORS),S=e.getParameter(e.MAX_FRAGMENT_UNIFORM_VECTORS),A=e.getParameter(e.MAX_SAMPLES),M=e.getParameter(e.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:a,getMaxPrecision:c,textureFormatReadable:o,textureTypeReadable:s,precision:d,logarithmicDepthBuffer:_,reversedDepthBuffer:p,maxTextures:v,maxVertexTextures:R,maxTextureSize:E,maxCubemapSize:u,maxAttributes:f,maxVertexUniforms:b,maxVaryings:D,maxFragmentUniforms:S,maxSamples:A,samples:M}}function zf(e){const n=this;let t=null,i=0,r=!1,a=!1;const o=new Wo,s=new Oe,c={value:null,needsUpdate:!1};this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(_,p){const v=_.length!==0||p||i!==0||r;return r=p,i=_.length,v},this.beginShadows=function(){a=!0,g(null)},this.endShadows=function(){a=!1},this.setGlobalState=function(_,p){t=g(_,p,0)},this.setState=function(_,p,v){const R=_.clippingPlanes,E=_.clipIntersection,u=_.clipShadows,f=e.get(_);if(!r||R===null||R.length===0||a&&!u)a?g(null):d();else{const b=a?0:i,D=b*4;let S=f.clippingState||null;c.value=S,S=g(R,p,D,v);for(let A=0;A!==D;++A)S[A]=t[A];f.clippingState=S,this.numIntersection=E?this.numPlanes:0,this.numPlanes+=b}};function d(){c.value!==t&&(c.value=t,c.needsUpdate=i>0),n.numPlanes=i,n.numIntersection=0}function g(_,p,v,R){const E=_!==null?_.length:0;let u=null;if(E!==0){if(u=c.value,R!==!0||u===null){const f=v+E*4,b=p.matrixWorldInverse;s.getNormalMatrix(b),(u===null||u.length<f)&&(u=new Float32Array(f));for(let D=0,S=v;D!==E;++D,S+=4)o.copy(_[D]).applyMatrix4(b,s),o.normal.toArray(u,S),u[S+3]=o.constant}c.value=u,c.needsUpdate=!0}return n.numPlanes=E,n.numIntersection=0,u}}const hn=4,Xf=6,Kf=20,qf=256,wn=new Pi,Or=new Ve;let fi=null,di=0,ui=0,pi=!1;const Yf=new me,Jt=new me;class Ai{constructor(n){this._renderer=n,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(n,t=0,i=.1,r=100,a={}){const{size:o=256,position:s=Yf}=a;fi=this._renderer.getRenderTarget(),di=this._renderer.getActiveCubeFace(),ui=this._renderer.getActiveMipmapLevel(),pi=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(o);const c=this._allocateTargets();return c.depthBuffer=!0,this._sceneToCubeUV(n,i,r,c,s),t>0&&this._blur(c,0,0,t),this._applyPMREM(c),this._cleanup(c),c}fromEquirectangular(n,t=null){return this._fromTexture(n,t)}fromCubemap(n,t=null){return this._fromTexture(n,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Hr(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Gr(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(n){this._lodMax=Math.floor(Math.log2(n)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let n=0;n<this._lodMeshes.length;n++)this._lodMeshes[n].geometry.dispose()}_cleanup(n){this._renderer.setRenderTarget(fi,di,ui),this._renderer.xr.enabled=pi,n.scissorTest=!1,ln(n,0,0,n.width,n.height)}_fromTexture(n,t){n.mapping===Nn||n.mapping===Sn?this._setSize(n.image.length===0?16:n.image[0].width||n.image[0].image.width):this._setSize(n.image.width/4),fi=this._renderer.getRenderTarget(),di=this._renderer.getActiveCubeFace(),ui=this._renderer.getActiveMipmapLevel(),pi=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const i=t||this._allocateTargets();return this._textureToCubeUV(n,i),this._applyPMREM(i),this._cleanup(i),i}_allocateTargets(){const n=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,i={magFilter:vt,minFilter:vt,generateMipmaps:!1,type:zt,format:kt,colorSpace:Dt,depthBuffer:!1},r=Br(n,t,i);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==n||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Br(n,t,i);const{_lodMax:a}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods}=Zf(a)),this._blurMaterial=jf(a,n,t),this._ggxMaterial=$f(a,n,t)}return r}_compileMaterial(n){const t=new et(new Tn,n);this._renderer.compile(t,wn)}_sceneToCubeUV(n,t,i,r,a){const c=new mn(90,1,t,i),d=[1,-1,1,1,1,1],g=[1,1,1,-1,-1,-1],_=this._renderer,p=_.autoClear,v=_.toneMapping;_.getClearColor(Or),_.toneMapping=Gt,_.autoClear=!1,_.state.buffers.depth.getReversed()&&(_.setRenderTarget(r),_.clearDepth(),_.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new et(new $n,new un({name:"PMREM.Background",side:At,depthWrite:!1,depthTest:!1})));const E=this._backgroundBox,u=E.material;let f=!1;const b=n.background;b?b.isColor&&(u.color.copy(b),n.background=null,f=!0):(u.color.copy(Or),f=!0);for(let D=0;D<6;D++){const S=D%3;S===0?(c.up.set(0,d[D],0),c.position.set(a.x,a.y,a.z),c.lookAt(a.x+g[D],a.y,a.z)):S===1?(c.up.set(0,0,d[D]),c.position.set(a.x,a.y,a.z),c.lookAt(a.x,a.y+g[D],a.z)):(c.up.set(0,d[D],0),c.position.set(a.x,a.y,a.z),c.lookAt(a.x,a.y,a.z+g[D]));const A=this._cubeSize;ln(r,S*A,D>2?A:0,A,A),_.setRenderTarget(r),f&&_.render(E,c),_.render(n,c)}_.toneMapping=v,_.autoClear=p,n.background=b}_textureToCubeUV(n,t){const i=this._renderer,r=n.mapping===Nn||n.mapping===Sn;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=Hr()),this._cubemapMaterial.uniforms.flipEnvMap.value=n.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Gr());const a=r?this._cubemapMaterial:this._equirectMaterial,o=this._lodMeshes[0];o.material=a;const s=a.uniforms;s.envMap.value=n;const c=this._cubeSize;ln(t,0,0,3*c,2*c),i.setRenderTarget(t),i.render(o,wn)}_applyPMREM(n){const t=this._renderer,i=t.autoClear;t.autoClear=!1;const r=this._lodMeshes.length;for(let a=1;a<r;a++)this._applyGGXFilter(n,a-1,a);t.autoClear=i}_applyGGXFilter(n,t,i){const r=this._renderer,a=this._pingPongRenderTarget,o=this._ggxMaterial,s=this._lodMeshes[i];s.material=o;const c=o.uniforms,d=i/(this._lodMeshes.length-1),g=t/(this._lodMeshes.length-1),_=Math.sqrt(d*d-g*g),p=d*1.25,v=_*p,{_lodMax:R}=this,E=this._sizeLods[i],u=3*E*(i>R-hn?i-R+hn:0),f=4*(this._cubeSize-E);c.envMap.value=n.texture,c.roughness.value=v,c.mipInt.value=R-t,ln(a,u,f,3*E,2*E),r.setRenderTarget(a),r.render(s,wn),c.envMap.value=a.texture,c.roughness.value=0,c.mipInt.value=R-i,ln(n,u,f,3*E,2*E),r.setRenderTarget(n),r.render(s,wn)}_blur(n,t,i,r){const a=this._pingPongRenderTarget,o=Math.min(r,Math.PI)/Math.SQRT2;this._blurPass(n,a,t,i,o),this._blurPass(a,n,i,i,o)}_blurPass(n,t,i,r,a){const o=this._renderer,s=this._blurMaterial,c=this._lodMeshes[r];c.material=s;const d=s.uniforms;d.envMap.value=n.texture,d.sigma.value=a,d.mipInt.value=this._lodMax-i;const g=this._sizeLods[r],_=3*g*(r>this._lodMax-hn?r-this._lodMax+hn:0),p=4*(this._cubeSize-g);ln(t,_,p,3*g,2*g),o.setRenderTarget(t),o.render(c,wn)}}function Zf(e){const n=[],t=[];let i=e;const r=e-hn+1+Xf;for(let a=0;a<r;a++){const o=Math.pow(2,i);n.push(o);const s=1/(o-2),c=-s,d=1+s,g=[c,c,d,c,d,d,c,c,d,d,c,d],_=6,p=6,v=3,R=new Float32Array(v*p*_),E=new Float32Array(v*p*_);for(let f=0;f<_;f++){const b=f%3*2/3-1,D=f>2?0:-1,S=[b,D,0,b+2/3,D,0,b+2/3,D+1,0,b,D,0,b+2/3,D+1,0,b,D+1,0];R.set(S,v*p*f);for(let A=0;A<p;A++){const M=g[A*2]*2-1,C=g[A*2+1]*2-1;f===0?Jt.set(1,C,M):f===1?Jt.set(-M,1,-C):f===2?Jt.set(-M,C,1):f===3?Jt.set(-1,C,-M):f===4?Jt.set(-M,-1,C):Jt.set(M,C,-1),Jt.toArray(E,(f*p+A)*v)}}const u=new Tn;u.setAttribute("position",new nn(R,v)),u.setAttribute("outputDirection",new nn(E,v)),t.push(new et(u,null)),i>hn&&i--}return{lodMeshes:t,sizeLods:n}}function Br(e,n,t){const i=new Lt(e,n,t);return i.texture.mapping=jn,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function ln(e,n,t,i,r){e.viewport.set(n,t,i,r),e.scissor.set(n,t,i,r)}function $f(e,n,t){return new Xt({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:qf,CUBEUV_TEXEL_WIDTH:1/n,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:Qn(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:Wt,depthTest:!1,depthWrite:!1})}function jf(e,n,t){return new Xt({name:"SphericalGaussianBlur",defines:{SAMPLES:Kf,CUBEUV_TEXEL_WIDTH:1/n,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},sigma:{value:0},mipInt:{value:0}},vertexShader:Qn(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float sigma;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359
			#define GOLDEN_ANGLE 2.39996322973

			void main() {

				if ( sigma == 0.0 ) {

					gl_FragColor = vec4( bilinearCubeUV( envMap, vOutputDirection, mipInt ), 1.0 );
					return;

				}

				vec3 outputDirection = normalize( vOutputDirection );

				vec3 up = abs( outputDirection.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
				vec3 tangent = normalize( cross( up, outputDirection ) );
				vec3 bitangent = cross( outputDirection, tangent );

				// Truncate the kernel at three standard deviations or at the antipode.
				float thetaMax = min( 3.0 * sigma, PI );
				float truncation = 1.0 - exp( - 0.5 * thetaMax * thetaMax / ( sigma * sigma ) );

				vec3 accumColor = vec3( 0.0 );
				float accumWeight = 0.0;

				for ( int i = 0; i < SAMPLES; i ++ ) {

					// Stratified inverse-CDF sampling of the Gaussian, placed on a golden-angle spiral.
					float stratum = ( float( i ) + 0.5 ) / float( SAMPLES );
					float theta = sigma * sqrt( - 2.0 * log( 1.0 - stratum * truncation ) );
					float phi = float( i ) * GOLDEN_ANGLE;

					vec3 offset = cos( phi ) * tangent + sin( phi ) * bitangent;
					vec3 sampleDirection = cos( theta ) * outputDirection + sin( theta ) * offset;

					// Correct the planar sample density to solid angle.
					float weight = sin( theta ) / theta;

					accumColor += weight * bilinearCubeUV( envMap, sampleDirection, mipInt );
					accumWeight += weight;

				}

				gl_FragColor = vec4( accumColor / accumWeight, 1.0 );

			}
		`,blending:Wt,depthTest:!1,depthWrite:!1})}function Gr(){return new Xt({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Qn(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Wt,depthTest:!1,depthWrite:!1})}function Hr(){return new Xt({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Qn(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Wt,depthTest:!1,depthWrite:!1})}function Qn(){return`

		precision mediump float;
		precision mediump int;

		attribute vec3 outputDirection;

		varying vec3 vOutputDirection;

		void main() {

			vOutputDirection = outputDirection;
			gl_Position = vec4( position, 1.0 );

		}
	`}class ka extends Lt{constructor(n=1,t={}){super(n,n,t),this.isWebGLCubeRenderTarget=!0;const i={width:n,height:n,depth:1},r=[i,i,i,i,i,i];this.texture=new xa(r),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(n,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;const i={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},r=new $n(5,5,5),a=new Xt({name:"CubemapFromEquirect",uniforms:Si(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:At,blending:Wt});a.uniforms.tEquirect.value=t;const o=new et(r,a),s=t.minFilter;return t.minFilter===$t&&(t.minFilter=vt),new ns(1,10,this).update(n,o),t.minFilter=s,o.geometry.dispose(),o.material.dispose(),this}clear(n,t=!0,i=!0,r=!0){const a=n.getRenderTarget();for(let o=0;o<6;o++)n.setRenderTarget(this,o),n.clear(t,i,r);n.setRenderTarget(a)}}function Qf(e){let n=new WeakMap,t=new WeakMap,i=null;function r(p,v=!1){return p==null?null:v?o(p):a(p)}function a(p){if(p&&p.isTexture){const v=p.mapping;if(v===si||v===ci)if(n.has(p)){const R=n.get(p).texture;return s(R,p.mapping)}else{const R=p.image;if(R&&R.height>0){const E=new ka(R.height);return E.fromEquirectangularTexture(e,p),n.set(p,E),p.addEventListener("dispose",d),s(E.texture,p.mapping)}else return null}}return p}function o(p){if(p&&p.isTexture){const v=p.mapping,R=v===si||v===ci,E=v===Nn||v===Sn;if(R||E){let u=t.get(p);const f=u!==void 0?u.texture.pmremVersion:0;if(p.isRenderTargetTexture&&p.pmremVersion!==f)return i===null&&(i=new Ai(e)),u=R?i.fromEquirectangular(p,u):i.fromCubemap(p,u),u.texture.pmremVersion=p.pmremVersion,t.set(p,u),u.texture;if(u!==void 0)return u.texture;{const b=p.image;return R&&b&&b.height>0||E&&b&&c(b)?(i===null&&(i=new Ai(e)),u=R?i.fromEquirectangular(p):i.fromCubemap(p),u.texture.pmremVersion=p.pmremVersion,t.set(p,u),p.addEventListener("dispose",g),u.texture):null}}}return p}function s(p,v){return v===si?p.mapping=Nn:v===ci&&(p.mapping=Sn),p}function c(p){let v=0;const R=6;for(let E=0;E<R;E++)p[E]!==void 0&&v++;return v===R}function d(p){const v=p.target;v.removeEventListener("dispose",d);const R=n.get(v);R!==void 0&&(n.delete(v),R.dispose())}function g(p){const v=p.target;v.removeEventListener("dispose",g);const R=t.get(v);R!==void 0&&(t.delete(v),R.dispose())}function _(){n=new WeakMap,t=new WeakMap,i!==null&&(i.dispose(),i=null)}return{get:r,dispose:_}}function Jf(e){const n={};function t(i){if(n[i]!==void 0)return n[i];const r=e.getExtension(i);return n[i]=r,r}return{has:function(i){return t(i)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(i){const r=t(i);return r===null&&ko("WebGLRenderer: "+i+" extension not supported."),r}}}function ed(e,n,t,i){const r={},a=new WeakMap;function o(_){const p=_.target;p.index!==null&&n.remove(p.index);for(const R in p.attributes)n.remove(p.attributes[R]);p.removeEventListener("dispose",o),delete r[p.id];const v=a.get(p);v&&(n.remove(v),a.delete(p)),i.releaseStatesOfGeometry(p),p.isInstancedBufferGeometry===!0&&delete p._maxInstanceCount,t.memory.geometries--}function s(_,p){return r[p.id]===!0||(p.addEventListener("dispose",o),r[p.id]=!0,t.memory.geometries++),p}function c(_){const p=_.attributes;for(const v in p)n.update(p[v],e.ARRAY_BUFFER)}function d(_){const p=[],v=_.index,R=_.attributes.position;let E=0;if(R===void 0)return;if(v!==null){const b=v.array;E=v.version;for(let D=0,S=b.length;D<S;D+=3){const A=b[D+0],M=b[D+1],C=b[D+2];p.push(A,M,M,C,C,A)}}else{const b=R.array;E=R.version;for(let D=0,S=b.length/3-1;D<S;D+=3){const A=D+0,M=D+1,C=D+2;p.push(A,M,M,C,C,A)}}const u=new(R.count>=65535?ds:us)(p,1);u.version=E;const f=a.get(_);f&&n.remove(f),a.set(_,u)}function g(_){const p=a.get(_);if(p){const v=_.index;v!==null&&p.version<v.version&&d(_)}else d(_);return a.get(_)}return{get:s,update:c,getWireframeAttribute:g}}function td(e,n,t){let i;function r(_){i=_}let a,o;function s(_){a=_.type,o=_.bytesPerElement}function c(_,p){e.drawElements(i,p,a,_*o),t.update(p,i,1)}function d(_,p,v){v!==0&&(e.drawElementsInstanced(i,p,a,_*o,v),t.update(p,i,v))}function g(_,p,v){if(v===0)return;n.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,p,0,a,_,0,v);let E=0;for(let u=0;u<v;u++)E+=p[u];t.update(E,i,1)}this.setMode=r,this.setIndex=s,this.render=c,this.renderInstances=d,this.renderMultiDraw=g}function nd(e){const n={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function i(a,o,s){switch(t.calls++,o){case e.TRIANGLES:t.triangles+=s*(a/3);break;case e.LINES:t.lines+=s*(a/2);break;case e.LINE_STRIP:t.lines+=s*(a-1);break;case e.LINE_LOOP:t.lines+=s*a;break;case e.POINTS:t.points+=s*a;break;default:nt("WebGLInfo: Unknown draw mode:",o);break}}function r(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:n,render:t,programs:null,autoReset:!0,reset:r,update:i}}function id(e,n,t){const i=new WeakMap,r=new xt;function a(o,s,c){const d=o.morphTargetInfluences,g=s.morphAttributes.position||s.morphAttributes.normal||s.morphAttributes.color,_=g!==void 0?g.length:0;let p=i.get(s);if(p===void 0||p.count!==_){let T=function(){C.dispose(),i.delete(s),s.removeEventListener("dispose",T)};p!==void 0&&p.texture.dispose();const v=s.morphAttributes.position!==void 0,R=s.morphAttributes.normal!==void 0,E=s.morphAttributes.color!==void 0,u=s.morphAttributes.position||[],f=s.morphAttributes.normal||[],b=s.morphAttributes.color||[];let D=0;v===!0&&(D=1),R===!0&&(D=2),E===!0&&(D=3);let S=s.attributes.position.count*D,A=1;S>n.maxTextureSize&&(A=Math.ceil(S/n.maxTextureSize),S=n.maxTextureSize);const M=new Float32Array(S*A*4*_),C=new Ta(M,S,A,_);C.type=jt,C.needsUpdate=!0;const m=D*4;for(let U=0;U<_;U++){const N=u[U],B=f[U],V=b[U],I=S*A*4*U;for(let X=0;X<N.count;X++){const Z=X*m;v===!0&&(r.fromBufferAttribute(N,X),M[I+Z+0]=r.x,M[I+Z+1]=r.y,M[I+Z+2]=r.z,M[I+Z+3]=0),R===!0&&(r.fromBufferAttribute(B,X),M[I+Z+4]=r.x,M[I+Z+5]=r.y,M[I+Z+6]=r.z,M[I+Z+7]=0),E===!0&&(r.fromBufferAttribute(V,X),M[I+Z+8]=r.x,M[I+Z+9]=r.y,M[I+Z+10]=r.z,M[I+Z+11]=V.itemSize===4?r.w:1)}}p={count:_,texture:C,size:new mt(S,A)},i.set(s,p),s.addEventListener("dispose",T)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)c.getUniforms().setValue(e,"morphTexture",o.morphTexture,t);else{let v=0;for(let E=0;E<d.length;E++)v+=d[E];const R=s.morphTargetsRelative?1:1-v;c.getUniforms().setValue(e,"morphTargetBaseInfluence",R),c.getUniforms().setValue(e,"morphTargetInfluences",d)}c.getUniforms().setValue(e,"morphTargetsTexture",p.texture,t),c.getUniforms().setValue(e,"morphTargetsTextureSize",p.size)}return{update:a}}function rd(e,n,t,i,r){let a=new WeakMap;function o(d){const g=r.render.frame,_=d.geometry,p=n.get(d,_);if(a.get(p)!==g&&(n.update(p),a.set(p,g)),d.isInstancedMesh&&(d.hasEventListener("dispose",c)===!1&&d.addEventListener("dispose",c),a.get(d)!==g&&(t.update(d.instanceMatrix,e.ARRAY_BUFFER),d.instanceColor!==null&&t.update(d.instanceColor,e.ARRAY_BUFFER),a.set(d,g))),d.isSkinnedMesh){const v=d.skeleton;a.get(v)!==g&&(v.update(),a.set(v,g))}return p}function s(){a=new WeakMap}function c(d){const g=d.target;g.removeEventListener("dispose",c),i.releaseStatesOfObject(g),t.remove(g.instanceMatrix),g.instanceColor!==null&&t.remove(g.instanceColor)}return{update:o,dispose:s}}const ad={[La]:"LINEAR_TONE_MAPPING",[Pa]:"REINHARD_TONE_MAPPING",[wa]:"CINEON_TONE_MAPPING",[Ui]:"ACES_FILMIC_TONE_MAPPING",[Ca]:"AGX_TONE_MAPPING",[ba]:"NEUTRAL_TONE_MAPPING",[Ra]:"CUSTOM_TONE_MAPPING"};function od(e,n,t,i,r,a){const o=new Lt(n,t,{type:e,depthBuffer:r,stencilBuffer:a,samples:i?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1});let s=null,c=null;const d=new Tn;d.setAttribute("position",new qi([-1,3,0,-1,-1,0,3,-1,0],3)),d.setAttribute("uv",new qi([0,2,0,0,2,0],2));const g=new Oo({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),_=new et(d,g),p=new Pi(-1,1,1,-1,0,1);let v=null,R=null,E=!1,u,f=null,b=[],D=!1;this.setSize=function(S,A){o.setSize(S,A),s!==null&&s.setSize(S,A),c!==null&&c.setSize(S,A);for(let M=0;M<b.length;M++){const C=b[M];C.setSize&&C.setSize(S,A)}},this.setEffects=function(S){b=S,D=b.length>0&&b[0].isRenderPass===!0;const A=o.width,M=o.height;b.length>0&&s===null&&(s=new Lt(A,M,{type:zt,depthBuffer:!1,stencilBuffer:!1}),c=new Lt(A,M,{type:zt,depthBuffer:!1,stencilBuffer:!1}));for(let C=0;C<b.length;C++){const m=b[C];m.setSize&&m.setSize(A,M)}},this.begin=function(S,A){if(E||S.toneMapping===Gt&&b.length===0)return!1;if(f=A,A!==null){const M=A.width,C=A.height;(o.width!==M||o.height!==C)&&this.setSize(M,C)}return D===!1&&S.setRenderTarget(o),u=S.toneMapping,S.toneMapping=Gt,!0},this.hasRenderPass=function(){return D},this.end=function(S,A){S.toneMapping=u,E=!0;let M=o,C=s;for(let m=0;m<b.length;m++){const T=b[m];T.enabled!==!1&&(T.render(S,C,M,A),T.needsSwap!==!1&&(M=C,C=C===s?c:s))}if(v!==S.outputColorSpace||R!==S.toneMapping){v=S.outputColorSpace,R=S.toneMapping,g.defines={},it.getTransfer(v)===Je&&(g.defines.SRGB_TRANSFER="");const m=ad[R];m&&(g.defines[m]=""),g.needsUpdate=!0}g.uniforms.tDiffuse.value=M.texture,S.setRenderTarget(f),S.render(_,p),f=null,E=!1},this.isCompositing=function(){return E},this.dispose=function(){o.dispose(),s!==null&&s.dispose(),c!==null&&c.dispose(),d.dispose(),g.dispose()}}const Wa=new Mi,Ri=new Yn(1,1),za=new Ta,Xa=new gs,Ka=new xa,Vr=[],kr=[],Wr=new Float32Array(16),zr=new Float32Array(9),Xr=new Float32Array(4);function An(e,n,t){const i=e[0];if(i<=0||i>0)return e;const r=n*t;let a=Vr[r];if(a===void 0&&(a=new Float32Array(r),Vr[r]=a),n!==0){i.toArray(a,0);for(let o=1,s=0;o!==n;++o)s+=t,e[o].toArray(a,s)}return a}function ut(e,n){if(e.length!==n.length)return!1;for(let t=0,i=e.length;t<i;t++)if(e[t]!==n[t])return!1;return!0}function pt(e,n){for(let t=0,i=n.length;t<i;t++)e[t]=n[t]}function Jn(e,n){let t=kr[n];t===void 0&&(t=new Int32Array(n),kr[n]=t);for(let i=0;i!==n;++i)t[i]=e.allocateTextureUnit();return t}function sd(e,n){const t=this.cache;t[0]!==n&&(e.uniform1f(this.addr,n),t[0]=n)}function cd(e,n){const t=this.cache;if(n.x!==void 0)(t[0]!==n.x||t[1]!==n.y)&&(e.uniform2f(this.addr,n.x,n.y),t[0]=n.x,t[1]=n.y);else{if(ut(t,n))return;e.uniform2fv(this.addr,n),pt(t,n)}}function ld(e,n){const t=this.cache;if(n.x!==void 0)(t[0]!==n.x||t[1]!==n.y||t[2]!==n.z)&&(e.uniform3f(this.addr,n.x,n.y,n.z),t[0]=n.x,t[1]=n.y,t[2]=n.z);else if(n.r!==void 0)(t[0]!==n.r||t[1]!==n.g||t[2]!==n.b)&&(e.uniform3f(this.addr,n.r,n.g,n.b),t[0]=n.r,t[1]=n.g,t[2]=n.b);else{if(ut(t,n))return;e.uniform3fv(this.addr,n),pt(t,n)}}function fd(e,n){const t=this.cache;if(n.x!==void 0)(t[0]!==n.x||t[1]!==n.y||t[2]!==n.z||t[3]!==n.w)&&(e.uniform4f(this.addr,n.x,n.y,n.z,n.w),t[0]=n.x,t[1]=n.y,t[2]=n.z,t[3]=n.w);else{if(ut(t,n))return;e.uniform4fv(this.addr,n),pt(t,n)}}function dd(e,n){const t=this.cache,i=n.elements;if(i===void 0){if(ut(t,n))return;e.uniformMatrix2fv(this.addr,!1,n),pt(t,n)}else{if(ut(t,i))return;Xr.set(i),e.uniformMatrix2fv(this.addr,!1,Xr),pt(t,i)}}function ud(e,n){const t=this.cache,i=n.elements;if(i===void 0){if(ut(t,n))return;e.uniformMatrix3fv(this.addr,!1,n),pt(t,n)}else{if(ut(t,i))return;zr.set(i),e.uniformMatrix3fv(this.addr,!1,zr),pt(t,i)}}function pd(e,n){const t=this.cache,i=n.elements;if(i===void 0){if(ut(t,n))return;e.uniformMatrix4fv(this.addr,!1,n),pt(t,n)}else{if(ut(t,i))return;Wr.set(i),e.uniformMatrix4fv(this.addr,!1,Wr),pt(t,i)}}function hd(e,n){const t=this.cache;t[0]!==n&&(e.uniform1i(this.addr,n),t[0]=n)}function md(e,n){const t=this.cache;if(n.x!==void 0)(t[0]!==n.x||t[1]!==n.y)&&(e.uniform2i(this.addr,n.x,n.y),t[0]=n.x,t[1]=n.y);else{if(ut(t,n))return;e.uniform2iv(this.addr,n),pt(t,n)}}function _d(e,n){const t=this.cache;if(n.x!==void 0)(t[0]!==n.x||t[1]!==n.y||t[2]!==n.z)&&(e.uniform3i(this.addr,n.x,n.y,n.z),t[0]=n.x,t[1]=n.y,t[2]=n.z);else{if(ut(t,n))return;e.uniform3iv(this.addr,n),pt(t,n)}}function gd(e,n){const t=this.cache;if(n.x!==void 0)(t[0]!==n.x||t[1]!==n.y||t[2]!==n.z||t[3]!==n.w)&&(e.uniform4i(this.addr,n.x,n.y,n.z,n.w),t[0]=n.x,t[1]=n.y,t[2]=n.z,t[3]=n.w);else{if(ut(t,n))return;e.uniform4iv(this.addr,n),pt(t,n)}}function vd(e,n){const t=this.cache;t[0]!==n&&(e.uniform1ui(this.addr,n),t[0]=n)}function Sd(e,n){const t=this.cache;if(n.x!==void 0)(t[0]!==n.x||t[1]!==n.y)&&(e.uniform2ui(this.addr,n.x,n.y),t[0]=n.x,t[1]=n.y);else{if(ut(t,n))return;e.uniform2uiv(this.addr,n),pt(t,n)}}function xd(e,n){const t=this.cache;if(n.x!==void 0)(t[0]!==n.x||t[1]!==n.y||t[2]!==n.z)&&(e.uniform3ui(this.addr,n.x,n.y,n.z),t[0]=n.x,t[1]=n.y,t[2]=n.z);else{if(ut(t,n))return;e.uniform3uiv(this.addr,n),pt(t,n)}}function Ed(e,n){const t=this.cache;if(n.x!==void 0)(t[0]!==n.x||t[1]!==n.y||t[2]!==n.z||t[3]!==n.w)&&(e.uniform4ui(this.addr,n.x,n.y,n.z,n.w),t[0]=n.x,t[1]=n.y,t[2]=n.z,t[3]=n.w);else{if(ut(t,n))return;e.uniform4uiv(this.addr,n),pt(t,n)}}function Md(e,n,t){const i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(e.uniform1i(this.addr,r),i[0]=r);let a;this.type===e.SAMPLER_2D_SHADOW?(Ri.compareFunction=t.isReversedDepthBuffer()?Li:Di,a=Ri):a=Wa,t.setTexture2D(n||a,r)}function Td(e,n,t){const i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(e.uniform1i(this.addr,r),i[0]=r),t.setTexture3D(n||Xa,r)}function Ad(e,n,t){const i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(e.uniform1i(this.addr,r),i[0]=r),t.setTextureCube(n||Ka,r)}function Rd(e,n,t){const i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(e.uniform1i(this.addr,r),i[0]=r),t.setTexture2DArray(n||za,r)}function bd(e){switch(e){case 5126:return sd;case 35664:return cd;case 35665:return ld;case 35666:return fd;case 35674:return dd;case 35675:return ud;case 35676:return pd;case 5124:case 35670:return hd;case 35667:case 35671:return md;case 35668:case 35672:return _d;case 35669:case 35673:return gd;case 5125:return vd;case 36294:return Sd;case 36295:return xd;case 36296:return Ed;case 35678:case 36198:case 36298:case 36306:case 35682:return Md;case 35679:case 36299:case 36307:return Td;case 35680:case 36300:case 36308:case 36293:return Ad;case 36289:case 36303:case 36311:case 36292:return Rd}}function Cd(e,n){e.uniform1fv(this.addr,n)}function wd(e,n){const t=An(n,this.size,2);e.uniform2fv(this.addr,t)}function Pd(e,n){const t=An(n,this.size,3);e.uniform3fv(this.addr,t)}function Ld(e,n){const t=An(n,this.size,4);e.uniform4fv(this.addr,t)}function Dd(e,n){const t=An(n,this.size,4);e.uniformMatrix2fv(this.addr,!1,t)}function Ud(e,n){const t=An(n,this.size,9);e.uniformMatrix3fv(this.addr,!1,t)}function yd(e,n){const t=An(n,this.size,16);e.uniformMatrix4fv(this.addr,!1,t)}function Id(e,n){e.uniform1iv(this.addr,n)}function Nd(e,n){e.uniform2iv(this.addr,n)}function Fd(e,n){e.uniform3iv(this.addr,n)}function Od(e,n){e.uniform4iv(this.addr,n)}function Bd(e,n){e.uniform1uiv(this.addr,n)}function Gd(e,n){e.uniform2uiv(this.addr,n)}function Hd(e,n){e.uniform3uiv(this.addr,n)}function Vd(e,n){e.uniform4uiv(this.addr,n)}function kd(e,n,t){const i=this.cache,r=n.length,a=Jn(t,r);ut(i,a)||(e.uniform1iv(this.addr,a),pt(i,a));let o;this.type===e.SAMPLER_2D_SHADOW?o=Ri:o=Wa;for(let s=0;s!==r;++s)t.setTexture2D(n[s]||o,a[s])}function Wd(e,n,t){const i=this.cache,r=n.length,a=Jn(t,r);ut(i,a)||(e.uniform1iv(this.addr,a),pt(i,a));for(let o=0;o!==r;++o)t.setTexture3D(n[o]||Xa,a[o])}function zd(e,n,t){const i=this.cache,r=n.length,a=Jn(t,r);ut(i,a)||(e.uniform1iv(this.addr,a),pt(i,a));for(let o=0;o!==r;++o)t.setTextureCube(n[o]||Ka,a[o])}function Xd(e,n,t){const i=this.cache,r=n.length,a=Jn(t,r);ut(i,a)||(e.uniform1iv(this.addr,a),pt(i,a));for(let o=0;o!==r;++o)t.setTexture2DArray(n[o]||za,a[o])}function Kd(e){switch(e){case 5126:return Cd;case 35664:return wd;case 35665:return Pd;case 35666:return Ld;case 35674:return Dd;case 35675:return Ud;case 35676:return yd;case 5124:case 35670:return Id;case 35667:case 35671:return Nd;case 35668:case 35672:return Fd;case 35669:case 35673:return Od;case 5125:return Bd;case 36294:return Gd;case 36295:return Hd;case 36296:return Vd;case 35678:case 36198:case 36298:case 36306:case 35682:return kd;case 35679:case 36299:case 36307:return Wd;case 35680:case 36300:case 36308:case 36293:return zd;case 36289:case 36303:case 36311:case 36292:return Xd}}class qd{constructor(n,t,i){this.id=n,this.addr=i,this.cache=[],this.type=t.type,this.setValue=bd(t.type)}}class Yd{constructor(n,t,i){this.id=n,this.addr=i,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Kd(t.type)}}class Zd{constructor(n){this.id=n,this.seq=[],this.map={}}setValue(n,t,i){const r=this.seq;for(let a=0,o=r.length;a!==o;++a){const s=r[a];s.setValue(n,t[s.id],i)}}}const hi=/(\w+)(\])?(\[|\.)?/g;function Kr(e,n){e.seq.push(n),e.map[n.id]=n}function $d(e,n,t){const i=e.name,r=i.length;for(hi.lastIndex=0;;){const a=hi.exec(i),o=hi.lastIndex;let s=a[1];const c=a[2]==="]",d=a[3];if(c&&(s=s|0),d===void 0||d==="["&&o+2===r){Kr(t,d===void 0?new qd(s,e,n):new Yd(s,e,n));break}else{let _=t.map[s];_===void 0&&(_=new Zd(s),Kr(t,_)),t=_}}}class Xn{constructor(n,t){this.seq=[],this.map={};const i=n.getProgramParameter(t,n.ACTIVE_UNIFORMS);for(let o=0;o<i;++o){const s=n.getActiveUniform(t,o),c=n.getUniformLocation(t,s.name);$d(s,c,this)}const r=[],a=[];for(const o of this.seq)o.type===n.SAMPLER_2D_SHADOW||o.type===n.SAMPLER_CUBE_SHADOW||o.type===n.SAMPLER_2D_ARRAY_SHADOW?r.push(o):a.push(o);r.length>0&&(this.seq=r.concat(a))}setValue(n,t,i,r){const a=this.map[t];a!==void 0&&a.setValue(n,i,r)}setOptional(n,t,i){const r=t[i];r!==void 0&&this.setValue(n,i,r)}static upload(n,t,i,r){for(let a=0,o=t.length;a!==o;++a){const s=t[a],c=i[s.id];c.needsUpdate!==!1&&s.setValue(n,c.value,r)}}static seqWithValue(n,t){const i=[];for(let r=0,a=n.length;r!==a;++r){const o=n[r];o.id in t&&i.push(o)}return i}}function qr(e,n,t){const i=e.createShader(n);return e.shaderSource(i,t),e.compileShader(i),i}const jd=37297;let Qd=0;function Jd(e,n){const t=e.split(`
`),i=[],r=Math.max(n-6,0),a=Math.min(n+6,t.length);for(let o=r;o<a;o++){const s=o+1;i.push(`${s===n?">":" "} ${s}: ${t[o]}`)}return i.join(`
`)}const Yr=new Oe;function eu(e){it._getMatrix(Yr,it.workingColorSpace,e);const n=`mat3( ${Yr.elements.map(t=>t.toFixed(4))} )`;switch(it.getTransfer(e)){case Aa:return[n,"LinearTransferOETF"];case Je:return[n,"sRGBTransferOETF"];default:return Xe("WebGLProgram: Unsupported color space: ",e),[n,"LinearTransferOETF"]}}function Zr(e,n,t){const i=e.getShaderParameter(n,e.COMPILE_STATUS),a=(e.getShaderInfoLog(n)||"").trim();if(i&&a==="")return"";const o=/ERROR: 0:(\d+)/.exec(a);if(o){const s=parseInt(o[1]);return t.toUpperCase()+`

`+a+`

`+Jd(e.getShaderSource(n),s)}else return a}function tu(e,n){const t=eu(n);return[`vec4 ${e}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}const nu={[La]:"Linear",[Pa]:"Reinhard",[wa]:"Cineon",[Ui]:"ACESFilmic",[Ca]:"AgX",[ba]:"Neutral",[Ra]:"Custom"};function iu(e,n){const t=nu[n];return t===void 0?(Xe("WebGLProgram: Unsupported toneMapping:",n),"vec3 "+e+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+e+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}const Hn=new me;function ru(){it.getLuminanceCoefficients(Hn);const e=Hn.x.toFixed(4),n=Hn.y.toFixed(4),t=Hn.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${e}, ${n}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function au(e){return[e.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",e.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(yn).join(`
`)}function ou(e){const n=[];for(const t in e){const i=e[t];i!==!1&&n.push("#define "+t+" "+i)}return n.join(`
`)}function su(e,n){const t={},i=e.getProgramParameter(n,e.ACTIVE_ATTRIBUTES);for(let r=0;r<i;r++){const a=e.getActiveAttrib(n,r),o=a.name;let s=1;a.type===e.FLOAT_MAT2&&(s=2),a.type===e.FLOAT_MAT3&&(s=3),a.type===e.FLOAT_MAT4&&(s=4),t[o]={type:a.type,location:e.getAttribLocation(n,o),locationSize:s}}return t}function yn(e){return e!==""}function $r(e,n){const t=n.numSpotLightShadows+n.numSpotLightMaps-n.numSpotLightShadowsWithMaps;return e.replace(/NUM_SUN_LIGHTS/g,n.numSunLights).replace(/NUM_DIR_LIGHTS/g,n.numDirLights).replace(/NUM_SPOT_LIGHTS/g,n.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,n.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,n.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,n.numPointLights).replace(/NUM_HEMI_LIGHTS/g,n.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,n.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,n.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,n.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,n.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,n.numPointLightShadows)}function jr(e,n){return e.replace(/NUM_CLIPPING_PLANES/g,n.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,n.numClippingPlanes-n.numClipIntersection)}const cu=/^[ \t]*#include +<([\w\d./]+)>/gm;function bi(e){return e.replace(cu,fu)}const lu=new Map;function fu(e,n){let t=Le[n];if(t===void 0){const i=lu.get(n);if(i!==void 0)t=Le[i],Xe('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',n,i);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+n+">")}return bi(t)}const du=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Qr(e){return e.replace(du,uu)}function uu(e,n,t,i){let r="";for(let a=parseInt(n);a<parseInt(t);a++)r+=i.replace(/\[\s*i\s*\]/g,"[ "+a+" ]").replace(/UNROLLED_LOOP_INDEX/g,a);return r}function Jr(e){let n=`precision ${e.precision} float;
	precision ${e.precision} int;
	precision ${e.precision} sampler2D;
	precision ${e.precision} samplerCube;
	precision ${e.precision} sampler3D;
	precision ${e.precision} sampler2DArray;
	precision ${e.precision} sampler2DShadow;
	precision ${e.precision} samplerCubeShadow;
	precision ${e.precision} sampler2DArrayShadow;
	precision ${e.precision} isampler2D;
	precision ${e.precision} isampler3D;
	precision ${e.precision} isamplerCube;
	precision ${e.precision} isampler2DArray;
	precision ${e.precision} usampler2D;
	precision ${e.precision} usampler3D;
	precision ${e.precision} usamplerCube;
	precision ${e.precision} usampler2DArray;
	`;return e.precision==="highp"?n+=`
#define HIGH_PRECISION`:e.precision==="mediump"?n+=`
#define MEDIUM_PRECISION`:e.precision==="lowp"&&(n+=`
#define LOW_PRECISION`),n}const pu={[kn]:"SHADOWMAP_TYPE_PCF",[Un]:"SHADOWMAP_TYPE_VSM"};function hu(e){return pu[e.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}const mu={[Nn]:"ENVMAP_TYPE_CUBE",[Sn]:"ENVMAP_TYPE_CUBE",[jn]:"ENVMAP_TYPE_CUBE_UV"};function _u(e){return e.envMap===!1?"ENVMAP_TYPE_CUBE":mu[e.envMapMode]||"ENVMAP_TYPE_CUBE"}const gu={[Sn]:"ENVMAP_MODE_REFRACTION"};function vu(e){return e.envMap===!1?"ENVMAP_MODE_REFLECTION":gu[e.envMapMode]||"ENVMAP_MODE_REFLECTION"}const Su={[_s]:"ENVMAP_BLENDING_MULTIPLY",[ms]:"ENVMAP_BLENDING_MIX",[hs]:"ENVMAP_BLENDING_ADD"};function xu(e){return e.envMap===!1?"ENVMAP_BLENDING_NONE":Su[e.combine]||"ENVMAP_BLENDING_NONE"}function Eu(e){const n=e.envMapCubeUVHeight;if(n===null)return null;const t=Math.log2(n)-2,i=1/n;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:i,maxMip:t}}function Mu(e,n,t,i){const r=e.getContext(),a=t.defines;let o=t.vertexShader,s=t.fragmentShader;const c=hu(t),d=_u(t),g=vu(t),_=xu(t),p=Eu(t),v=au(t),R=ou(a),E=r.createProgram();let u,f,b=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(u=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,R].filter(yn).join(`
`),u.length>0&&(u+=`
`),f=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,R].filter(yn).join(`
`),f.length>0&&(f+=`
`)):(u=[Jr(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,R,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+g:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexNormals?"#define HAS_NORMAL":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+c:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(yn).join(`
`),f=[Jr(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,R,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+d:"",t.envMap?"#define "+g:"",t.envMap?"#define "+_:"",p?"#define CUBEUV_TEXEL_WIDTH "+p.texelWidth:"",p?"#define CUBEUV_TEXEL_HEIGHT "+p.texelHeight:"",p?"#define CUBEUV_MAX_MIP "+p.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.retroreflection?"#define USE_RETROREFLECTION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas||t.batchingColor?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+c:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==Gt?"#define TONE_MAPPING":"",t.toneMapping!==Gt?Le.tonemapping_pars_fragment:"",t.toneMapping!==Gt?iu("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Le.colorspace_pars_fragment,tu("linearToOutputTexel",t.outputColorSpace),ru(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(yn).join(`
`)),o=bi(o),o=$r(o,t),o=jr(o,t),s=bi(s),s=$r(s,t),s=jr(s,t),o=Qr(o),s=Qr(s),t.isRawShaderMaterial!==!0&&(b=`#version 300 es
`,u=[v,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+u,f=["#define varying in",t.glslVersion===Lr?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===Lr?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+f);const D=b+u+o,S=b+f+s,A=qr(r,r.VERTEX_SHADER,D),M=qr(r,r.FRAGMENT_SHADER,S);r.attachShader(E,A),r.attachShader(E,M),t.index0AttributeName!==void 0?r.bindAttribLocation(E,0,t.index0AttributeName):t.hasPositionAttribute===!0&&r.bindAttribLocation(E,0,"position"),r.linkProgram(E);function C(N){if(e.debug.checkShaderErrors){const B=r.getProgramInfoLog(E)||"",V=r.getShaderInfoLog(A)||"",I=r.getShaderInfoLog(M)||"",X=B.trim(),Z=V.trim(),Y=I.trim();let te=!0,$=!0;if(r.getProgramParameter(E,r.LINK_STATUS)===!1)if(te=!1,typeof e.debug.onShaderError=="function")e.debug.onShaderError(r,E,A,M);else{const J=Zr(r,A,"vertex"),ee=Zr(r,M,"fragment");nt("WebGLProgram: Shader Error "+r.getError()+" - VALIDATE_STATUS "+r.getProgramParameter(E,r.VALIDATE_STATUS)+`

Material Name: `+N.name+`
Material Type: `+N.type+`

Program Info Log: `+X+`
`+J+`
`+ee)}else X!==""?Xe("WebGLProgram: Program Info Log:",X):(Z===""||Y==="")&&($=!1);$&&(N.diagnostics={runnable:te,programLog:X,vertexShader:{log:Z,prefix:u},fragmentShader:{log:Y,prefix:f}})}r.deleteShader(A),r.deleteShader(M),m=new Xn(r,E),T=su(r,E)}let m;this.getUniforms=function(){return m===void 0&&C(this),m};let T;this.getAttributes=function(){return T===void 0&&C(this),T};let U=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return U===!1&&(U=r.getProgramParameter(E,jd)),U},this.destroy=function(){i.releaseStatesOfProgram(this),r.deleteProgram(E),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=Qd++,this.cacheKey=n,this.usedTimes=1,this.program=E,this.vertexShader=A,this.fragmentShader=M,this}let Tu=0;class Au{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(n,t,i){const r=this._getShaderCacheForMaterial(n);return r.has(t)===!1&&(r.add(t),t.usedTimes++),r.has(i)===!1&&(r.add(i),i.usedTimes++),this}remove(n){const t=this.materialCache.get(n);for(const i of t)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(n),this}getVertexShaderStage(n){return this._getShaderStage(n.vertexShader)}getFragmentShaderStage(n){return this._getShaderStage(n.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(n){const t=this.materialCache;let i=t.get(n);return i===void 0&&(i=new Set,t.set(n,i)),i}_getShaderStage(n){const t=this.shaderCache;let i=t.get(n);return i===void 0&&(i=new Ru(n),t.set(n,i)),i}}class Ru{constructor(n){this.id=Tu++,this.code=n,this.usedTimes=0}}function bu(e){return e===xn||e===xi||e===Ei}function Cu(e,n,t,i,r,a){const o=new fs,s=new Au,c=new Set,d=[],g=new Map,_=i.logarithmicDepthBuffer;let p=i.precision;const v={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function R(m){return c.add(m),m===0?"uv":`uv${m}`}function E(m,T,U,N,B,V){const I=N.fog,X=B.geometry,Z=m.isMeshStandardMaterial||m.isMeshLambertMaterial||m.isMeshPhongMaterial?N.environment:null,Y=m.isMeshStandardMaterial||m.isMeshLambertMaterial&&!m.envMap||m.isMeshPhongMaterial&&!m.envMap,te=n.get(m.envMap||Z,Y),$=te&&te.mapping===jn?te.image.height:null,J=v[m.type];m.precision!==null&&(p=i.getMaxPrecision(m.precision),p!==m.precision&&Xe("WebGLProgram.getParameters:",m.precision,"not supported, using",p,"instead."));const ee=X.morphAttributes.position||X.morphAttributes.normal||X.morphAttributes.color,we=ee!==void 0?ee.length:0;let Ce=0;X.morphAttributes.position!==void 0&&(Ce=1),X.morphAttributes.normal!==void 0&&(Ce=2),X.morphAttributes.color!==void 0&&(Ce=3);let ot,Ke,qe,z;if(J){const je=Ft[J];ot=je.vertexShader,Ke=je.fragmentShader}else{ot=m.vertexShader,Ke=m.fragmentShader;const je=s.getVertexShaderStage(m),ke=s.getFragmentShaderStage(m);s.update(m,je,ke),qe=je.id,z=ke.id}const j=e.getRenderTarget(),Ee=e.state.buffers.depth.getReversed(),Ue=B.isInstancedMesh===!0,_e=B.isBatchedMesh===!0,Be=!!m.map,dt=!!m.matcap,Ie=!!te,He=!!m.aoMap,$e=!!m.lightMap,Fe=!!m.bumpMap&&m.wireframe===!1,rt=!!m.normalMap,ht=!!m.displacementMap,Mt=!!m.emissiveMap,at=!!m.metalnessMap,lt=!!m.roughnessMap,L=m.anisotropy>0,_t=m.clearcoat>0,ze=m.dispersion>0,x=m.retroreflectivity>0,l=m.iridescence>0,y=m.sheen>0,G=m.transmission>0,k=L&&!!m.anisotropyMap,ne=_t&&!!m.clearcoatMap,ie=_t&&!!m.clearcoatNormalMap,W=_t&&!!m.clearcoatRoughnessMap,q=l&&!!m.iridescenceMap,re=l&&!!m.iridescenceThicknessMap,Me=y&&!!m.sheenColorMap,ce=y&&!!m.sheenRoughnessMap,ae=!!m.specularMap,Te=!!m.specularColorMap,be=!!m.specularIntensityMap,Pe=G&&!!m.transmissionMap,P=G&&!!m.thicknessMap,oe=!!m.gradientMap,K=!!m.alphaMap,se=m.alphaTest>0,ue=!!m.alphaHash,Q=!!m.extensions;let Ae=Gt;m.toneMapped&&(j===null||j.isXRRenderTarget===!0)&&(Ae=e.toneMapping);const Se={shaderID:J,shaderType:m.type,shaderName:m.name,vertexShader:ot,fragmentShader:Ke,defines:m.defines,customVertexShaderID:qe,customFragmentShaderID:z,isRawShaderMaterial:m.isRawShaderMaterial===!0,glslVersion:m.glslVersion,precision:p,batching:_e,batchingColor:_e&&B._colorsTexture!==null,instancing:Ue,instancingColor:Ue&&B.instanceColor!==null,instancingMorph:Ue&&B.morphTexture!==null,outputColorSpace:j===null?e.outputColorSpace:j.isXRRenderTarget===!0?j.texture.colorSpace:it.workingColorSpace,alphaToCoverage:!!m.alphaToCoverage,map:Be,matcap:dt,envMap:Ie,envMapMode:Ie&&te.mapping,envMapCubeUVHeight:$,aoMap:He,lightMap:$e,bumpMap:Fe,normalMap:rt,displacementMap:ht,emissiveMap:Mt,normalMapObjectSpace:rt&&m.normalMapType===ts,normalMapTangentSpace:rt&&m.normalMapType===Qi,packedNormalMap:rt&&m.normalMapType===Qi&&bu(m.normalMap.format),metalnessMap:at,roughnessMap:lt,anisotropy:L,anisotropyMap:k,clearcoat:_t,clearcoatMap:ne,clearcoatNormalMap:ie,clearcoatRoughnessMap:W,dispersion:ze,retroreflection:x,iridescence:l,iridescenceMap:q,iridescenceThicknessMap:re,sheen:y,sheenColorMap:Me,sheenRoughnessMap:ce,specularMap:ae,specularColorMap:Te,specularIntensityMap:be,transmission:G,transmissionMap:Pe,thicknessMap:P,gradientMap:oe,opaque:m.transparent===!1&&m.blending===Wn&&m.alphaToCoverage===!1,alphaMap:K,alphaTest:se,alphaHash:ue,combine:m.combine,mapUv:Be&&R(m.map.channel),aoMapUv:He&&R(m.aoMap.channel),lightMapUv:$e&&R(m.lightMap.channel),bumpMapUv:Fe&&R(m.bumpMap.channel),normalMapUv:rt&&R(m.normalMap.channel),displacementMapUv:ht&&R(m.displacementMap.channel),emissiveMapUv:Mt&&R(m.emissiveMap.channel),metalnessMapUv:at&&R(m.metalnessMap.channel),roughnessMapUv:lt&&R(m.roughnessMap.channel),anisotropyMapUv:k&&R(m.anisotropyMap.channel),clearcoatMapUv:ne&&R(m.clearcoatMap.channel),clearcoatNormalMapUv:ie&&R(m.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:W&&R(m.clearcoatRoughnessMap.channel),iridescenceMapUv:q&&R(m.iridescenceMap.channel),iridescenceThicknessMapUv:re&&R(m.iridescenceThicknessMap.channel),sheenColorMapUv:Me&&R(m.sheenColorMap.channel),sheenRoughnessMapUv:ce&&R(m.sheenRoughnessMap.channel),specularMapUv:ae&&R(m.specularMap.channel),specularColorMapUv:Te&&R(m.specularColorMap.channel),specularIntensityMapUv:be&&R(m.specularIntensityMap.channel),transmissionMapUv:Pe&&R(m.transmissionMap.channel),thicknessMapUv:P&&R(m.thicknessMap.channel),alphaMapUv:K&&R(m.alphaMap.channel),vertexTangents:!!X.attributes.tangent&&(rt||L),vertexNormals:!!X.attributes.normal,vertexColors:m.vertexColors,vertexAlphas:m.vertexColors===!0&&!!X.attributes.color&&X.attributes.color.itemSize===4,pointsUvs:B.isPoints===!0&&!!X.attributes.uv&&(Be||K),fog:!!I,useFog:m.fog===!0,fogExp2:!!I&&I.isFogExp2,flatShading:m.wireframe===!1&&(m.flatShading===!0||X.attributes.normal===void 0&&rt===!1&&(m.isMeshLambertMaterial||m.isMeshPhongMaterial||m.isMeshStandardMaterial||m.isMeshPhysicalMaterial)),sizeAttenuation:m.sizeAttenuation===!0,logarithmicDepthBuffer:_,reversedDepthBuffer:Ee,skinning:B.isSkinnedMesh===!0,hasPositionAttribute:X.attributes.position!==void 0,morphTargets:X.morphAttributes.position!==void 0,morphNormals:X.morphAttributes.normal!==void 0,morphColors:X.morphAttributes.color!==void 0,morphTargetsCount:we,morphTextureStride:Ce,numSunLights:T.sun.length,numDirLights:T.directional.length,numPointLights:T.point.length,numSpotLights:T.spot.length,numSpotLightMaps:T.spotLightMap.length,numRectAreaLights:T.rectArea.length,numHemiLights:T.hemi.length,numSunLightShadows:T.sunShadowMap.length,numDirLightShadows:T.directionalShadowMap.length,numPointLightShadows:T.pointShadowMap.length,numSpotLightShadows:T.spotShadowMap.length,numSpotLightShadowsWithMaps:T.numSpotLightShadowsWithMaps,numLightProbes:T.numLightProbes,numLightProbeGrids:V.length,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:m.dithering,shadowMapEnabled:e.shadowMap.enabled&&U.length>0,shadowMapType:e.shadowMap.type,toneMapping:Ae,decodeVideoTexture:Be&&m.map.isVideoTexture===!0&&it.getTransfer(m.map.colorSpace)===Je,decodeVideoTextureEmissive:Mt&&m.emissiveMap.isVideoTexture===!0&&it.getTransfer(m.emissiveMap.colorSpace)===Je,premultipliedAlpha:m.premultipliedAlpha,doubleSided:m.side===Bt,flipSided:m.side===At,useDepthPacking:m.depthPacking>=0,depthPacking:m.depthPacking||0,index0AttributeName:m.index0AttributeName,extensionClipCullDistance:Q&&m.extensions.clipCullDistance===!0&&t.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(Q&&m.extensions.multiDraw===!0||_e)&&t.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:t.has("KHR_parallel_shader_compile"),customProgramCacheKey:m.customProgramCacheKey()};return Se.vertexUv1s=c.has(1),Se.vertexUv2s=c.has(2),Se.vertexUv3s=c.has(3),c.clear(),Se}function u(m){const T=[];if(m.shaderID?T.push(m.shaderID):(T.push(m.customVertexShaderID),T.push(m.customFragmentShaderID)),m.defines!==void 0)for(const U in m.defines)T.push(U),T.push(m.defines[U]);return m.isRawShaderMaterial===!1&&(f(T,m),b(T,m),T.push(e.outputColorSpace)),T.push(m.customProgramCacheKey),T.join()}function f(m,T){m.push(T.precision),m.push(T.outputColorSpace),m.push(T.envMapMode),m.push(T.envMapCubeUVHeight),m.push(T.mapUv),m.push(T.alphaMapUv),m.push(T.lightMapUv),m.push(T.aoMapUv),m.push(T.bumpMapUv),m.push(T.normalMapUv),m.push(T.displacementMapUv),m.push(T.emissiveMapUv),m.push(T.metalnessMapUv),m.push(T.roughnessMapUv),m.push(T.anisotropyMapUv),m.push(T.clearcoatMapUv),m.push(T.clearcoatNormalMapUv),m.push(T.clearcoatRoughnessMapUv),m.push(T.iridescenceMapUv),m.push(T.iridescenceThicknessMapUv),m.push(T.sheenColorMapUv),m.push(T.sheenRoughnessMapUv),m.push(T.specularMapUv),m.push(T.specularColorMapUv),m.push(T.specularIntensityMapUv),m.push(T.transmissionMapUv),m.push(T.thicknessMapUv),m.push(T.combine),m.push(T.fogExp2),m.push(T.sizeAttenuation),m.push(T.morphTargetsCount),m.push(T.morphAttributeCount),m.push(T.numSunLights),m.push(T.numDirLights),m.push(T.numPointLights),m.push(T.numSpotLights),m.push(T.numSpotLightMaps),m.push(T.numHemiLights),m.push(T.numRectAreaLights),m.push(T.numSunLightShadows),m.push(T.numDirLightShadows),m.push(T.numPointLightShadows),m.push(T.numSpotLightShadows),m.push(T.numSpotLightShadowsWithMaps),m.push(T.numLightProbes),m.push(T.shadowMapType),m.push(T.toneMapping),m.push(T.numClippingPlanes),m.push(T.numClipIntersection),m.push(T.depthPacking)}function b(m,T){o.disableAll(),T.instancing&&o.enable(0),T.instancingColor&&o.enable(1),T.instancingMorph&&o.enable(2),T.matcap&&o.enable(3),T.envMap&&o.enable(4),T.normalMapObjectSpace&&o.enable(5),T.normalMapTangentSpace&&o.enable(6),T.clearcoat&&o.enable(7),T.iridescence&&o.enable(8),T.alphaTest&&o.enable(9),T.vertexColors&&o.enable(10),T.vertexAlphas&&o.enable(11),T.vertexUv1s&&o.enable(12),T.vertexUv2s&&o.enable(13),T.vertexUv3s&&o.enable(14),T.vertexTangents&&o.enable(15),T.anisotropy&&o.enable(16),T.alphaHash&&o.enable(17),T.batching&&o.enable(18),T.dispersion&&o.enable(19),T.retroreflection&&o.enable(24),T.batchingColor&&o.enable(20),T.gradientMap&&o.enable(21),T.packedNormalMap&&o.enable(22),T.vertexNormals&&o.enable(23),m.push(o.mask),o.disableAll(),T.fog&&o.enable(0),T.useFog&&o.enable(1),T.flatShading&&o.enable(2),T.logarithmicDepthBuffer&&o.enable(3),T.reversedDepthBuffer&&o.enable(4),T.skinning&&o.enable(5),T.morphTargets&&o.enable(6),T.morphNormals&&o.enable(7),T.morphColors&&o.enable(8),T.premultipliedAlpha&&o.enable(9),T.shadowMapEnabled&&o.enable(10),T.doubleSided&&o.enable(11),T.flipSided&&o.enable(12),T.useDepthPacking&&o.enable(13),T.dithering&&o.enable(14),T.transmission&&o.enable(15),T.sheen&&o.enable(16),T.opaque&&o.enable(17),T.pointsUvs&&o.enable(18),T.decodeVideoTexture&&o.enable(19),T.decodeVideoTextureEmissive&&o.enable(20),T.alphaToCoverage&&o.enable(21),T.numLightProbeGrids>0&&o.enable(22),T.hasPositionAttribute&&o.enable(23),m.push(o.mask)}function D(m){const T=v[m.type];let U;if(T){const N=Ft[T];U=es.clone(N.uniforms)}else U=m.uniforms;return U}function S(m,T){let U=g.get(T);return U!==void 0?++U.usedTimes:(U=new Mu(e,T,m,r),d.push(U),g.set(T,U)),U}function A(m){if(--m.usedTimes===0){const T=d.indexOf(m);d[T]=d[d.length-1],d.pop(),g.delete(m.cacheKey),m.destroy()}}function M(m){s.remove(m)}function C(){s.dispose()}return{getParameters:E,getProgramCacheKey:u,getUniforms:D,acquireProgram:S,releaseProgram:A,releaseShaderCache:M,programs:d,dispose:C}}function wu(){let e=new WeakMap;function n(o){return e.has(o)}function t(o){let s=e.get(o);return s===void 0&&(s={},e.set(o,s)),s}function i(o){e.delete(o)}function r(o,s,c){e.get(o)[s]=c}function a(){e=new WeakMap}return{has:n,get:t,remove:i,update:r,dispose:a}}function Pu(e,n){return e.groupOrder!==n.groupOrder?e.groupOrder-n.groupOrder:e.renderOrder!==n.renderOrder?e.renderOrder-n.renderOrder:e.material.id!==n.material.id?e.material.id-n.material.id:e.materialVariant!==n.materialVariant?e.materialVariant-n.materialVariant:e.z!==n.z?e.z-n.z:e.id-n.id}function ea(e,n){return e.groupOrder!==n.groupOrder?e.groupOrder-n.groupOrder:e.renderOrder!==n.renderOrder?e.renderOrder-n.renderOrder:e.z!==n.z?n.z-e.z:e.id-n.id}function ta(){const e=[];let n=0;const t=[],i=[],r=[];function a(){n=0,t.length=0,i.length=0,r.length=0}function o(p){let v=0;return p.isInstancedMesh&&(v+=2),p.isSkinnedMesh&&(v+=1),v}function s(p,v,R,E,u,f){let b=e[n];return b===void 0?(b={id:p.id,object:p,geometry:v,material:R,materialVariant:o(p),groupOrder:E,renderOrder:p.renderOrder,z:u,group:f},e[n]=b):(b.id=p.id,b.object=p,b.geometry=v,b.material=R,b.materialVariant=o(p),b.groupOrder=E,b.renderOrder=p.renderOrder,b.z=u,b.group=f),n++,b}function c(p,v,R,E,u,f,b){b.reversedDepth===!0&&(u=-u);const D=s(p,v,R,E,u,f);R.transmission>0?i.push(D):R.transparent===!0?r.push(D):t.push(D)}function d(p,v,R,E,u,f){const b=s(p,v,R,E,u,f);R.transmission>0?i.unshift(b):R.transparent===!0?r.unshift(b):t.unshift(b)}function g(p,v){t.length>1&&t.sort(p||Pu),i.length>1&&i.sort(v||ea),r.length>1&&r.sort(v||ea)}function _(){for(let p=n,v=e.length;p<v;p++){const R=e[p];if(R.id===null)break;R.id=null,R.object=null,R.geometry=null,R.material=null,R.group=null}}return{opaque:t,transmissive:i,transparent:r,init:a,push:c,unshift:d,finish:_,sort:g}}function Lu(){let e=new WeakMap;function n(i,r){const a=e.get(i);let o;return a===void 0?(o=new ta,e.set(i,[o])):r>=a.length?(o=new ta,a.push(o)):o=a[r],o}function t(){e=new WeakMap}return{get:n,dispose:t}}function Du(){const e={};return{get:function(n){if(e[n.id]!==void 0)return e[n.id];let t;switch(n.type){case"SunLight":case"DirectionalLight":t={direction:new me,color:new Ve};break;case"SpotLight":t={position:new me,direction:new me,color:new Ve,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new me,color:new Ve,distance:0,decay:0};break;case"HemisphereLight":t={direction:new me,skyColor:new Ve,groundColor:new Ve};break;case"RectAreaLight":t={color:new Ve,position:new me,halfWidth:new me,halfHeight:new me};break}return e[n.id]=t,t}}}function Uu(){const e={};return{get:function(n){if(e[n.id]!==void 0)return e[n.id];let t;switch(n.type){case"SunLight":case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new mt};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new mt};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new mt,shadowCameraNear:1,shadowCameraFar:1e3};break}return e[n.id]=t,t}}}let yu=0;function Iu(e,n){return(n.castShadow?2:0)-(e.castShadow?2:0)+(n.map?1:0)-(e.map?1:0)}function Nu(e){const n=new Du,t=Uu(),i={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let d=0;d<9;d++)i.probe.push(new me);const r=new me,a=new Et,o=new Et;function s(d){let g=0,_=0,p=0;for(let B=0;B<9;B++)i.probe[B].set(0,0,0);let v=0,R=0,E=0,u=0,f=0,b=0,D=0,S=0,A=0,M=0,C=0,m=0,T=0,U=0;d.sort(Iu);for(let B=0,V=d.length;B<V;B++){const I=d[B],X=I.color,Z=I.intensity,Y=I.distance;let te=null;if(I.shadow&&I.shadow.map&&(I.shadow.map.texture.format===xn?te=I.shadow.map.texture:te=I.shadow.map.depthTexture||I.shadow.map.texture),I.isAmbientLight)g+=X.r*Z,_+=X.g*Z,p+=X.b*Z;else if(I.isLightProbe){for(let $=0;$<9;$++)i.probe[$].addScaledVector(I.sh.coefficients[$],Z);U++}else if(I.isSunLight){const $=n.get(I);if($.color.copy(I.color).multiplyScalar(I.intensity),I.castShadow){const J=I.shadow,ee=t.get(I);ee.shadowIntensity=J.intensity,ee.shadowBias=J.bias,ee.shadowNormalBias=J.normalBias,ee.shadowRadius=J.radius,ee.shadowMapSize.copy(J.mapSize).multiply(J.getFrameExtents()),i.sunShadow[R]=ee,i.sunShadowMap[R]=te;const we=J.getViewportCount();for(let Ce=0;Ce<we;Ce++)i.sunShadowMatrix[E+Ce]=J.getMatrix(Ce),i.sunShadowCascade[E+Ce]=J._cascadeData[Ce];E+=we,R++}i.sun[v]=$,v++}else if(I.isDirectionalLight){const $=n.get(I);if($.color.copy(I.color).multiplyScalar(I.intensity),I.castShadow){const J=I.shadow,ee=t.get(I);ee.shadowIntensity=J.intensity,ee.shadowBias=J.bias,ee.shadowNormalBias=J.normalBias,ee.shadowRadius=J.radius,ee.shadowMapSize=J.mapSize,i.directionalShadow[u]=ee,i.directionalShadowMap[u]=te,i.directionalShadowMatrix[u]=I.shadow.matrix,A++}i.directional[u]=$,u++}else if(I.isSpotLight){const $=n.get(I);$.position.setFromMatrixPosition(I.matrixWorld),$.color.copy(X).multiplyScalar(Z),$.distance=Y,$.coneCos=Math.cos(I.angle),$.penumbraCos=Math.cos(I.angle*(1-I.penumbra)),$.decay=I.decay,i.spot[b]=$;const J=I.shadow;if(I.map&&(i.spotLightMap[m]=I.map,m++,J.updateMatrices(I),I.castShadow&&T++),i.spotLightMatrix[b]=J.matrix,I.castShadow){const ee=t.get(I);ee.shadowIntensity=J.intensity,ee.shadowBias=J.bias,ee.shadowNormalBias=J.normalBias,ee.shadowRadius=J.radius,ee.shadowMapSize=J.mapSize,i.spotShadow[b]=ee,i.spotShadowMap[b]=te,C++}b++}else if(I.isRectAreaLight){const $=n.get(I);$.color.copy(X).multiplyScalar(Z),$.halfWidth.set(I.width*.5,0,0),$.halfHeight.set(0,I.height*.5,0),i.rectArea[D]=$,D++}else if(I.isPointLight){const $=n.get(I);if($.color.copy(I.color).multiplyScalar(I.intensity),$.distance=I.distance,$.decay=I.decay,I.castShadow){const J=I.shadow,ee=t.get(I);ee.shadowIntensity=J.intensity,ee.shadowBias=J.bias,ee.shadowNormalBias=J.normalBias,ee.shadowRadius=J.radius,ee.shadowMapSize=J.mapSize,ee.shadowCameraNear=J.camera.near,ee.shadowCameraFar=J.camera.far,i.pointShadow[f]=ee,i.pointShadowMap[f]=te,i.pointShadowMatrix[f]=I.shadow.matrix,M++}i.point[f]=$,f++}else if(I.isHemisphereLight){const $=n.get(I);$.skyColor.copy(I.color).multiplyScalar(Z),$.groundColor.copy(I.groundColor).multiplyScalar(Z),i.hemi[S]=$,S++}}D>0&&(e.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=le.LTC_FLOAT_1,i.rectAreaLTC2=le.LTC_FLOAT_2):(i.rectAreaLTC1=le.LTC_HALF_1,i.rectAreaLTC2=le.LTC_HALF_2)),i.ambient[0]=g,i.ambient[1]=_,i.ambient[2]=p;const N=i.hash;(N.sunLength!==v||N.directionalLength!==u||N.pointLength!==f||N.spotLength!==b||N.rectAreaLength!==D||N.hemiLength!==S||N.numSunShadows!==R||N.numDirectionalShadows!==A||N.numPointShadows!==M||N.numSpotShadows!==C||N.numSpotMaps!==m||N.numLightProbes!==U)&&(i.sun.length=v,i.directional.length=u,i.spot.length=b,i.rectArea.length=D,i.point.length=f,i.hemi.length=S,i.sunShadow.length=R,i.sunShadowMap.length=R,i.sunShadowMatrix.length=E,i.sunShadowCascade.length=E,i.directionalShadow.length=A,i.directionalShadowMap.length=A,i.directionalShadowMatrix.length=A,i.pointShadow.length=M,i.pointShadowMap.length=M,i.pointShadowMatrix.length=M,i.spotShadow.length=C,i.spotShadowMap.length=C,i.spotLightMatrix.length=C+m-T,i.spotLightMap.length=m,i.numSpotLightShadowsWithMaps=T,i.numLightProbes=U,N.sunLength=v,N.directionalLength=u,N.pointLength=f,N.spotLength=b,N.rectAreaLength=D,N.hemiLength=S,N.numSunShadows=R,N.numDirectionalShadows=A,N.numPointShadows=M,N.numSpotShadows=C,N.numSpotMaps=m,N.numLightProbes=U,i.version=yu++)}function c(d,g){let _=0,p=0,v=0,R=0,E=0,u=0;const f=g.matrixWorldInverse;for(let b=0,D=d.length;b<D;b++){const S=d[b];if(S.isSunLight){const A=i.sun[_];A.direction.setFromMatrixPosition(S.matrixWorld),A.direction.transformDirection(f),_++}else if(S.isDirectionalLight){const A=i.directional[p];A.direction.setFromMatrixPosition(S.matrixWorld),r.setFromMatrixPosition(S.target.matrixWorld),A.direction.sub(r),A.direction.transformDirection(f),p++}else if(S.isSpotLight){const A=i.spot[R];A.position.setFromMatrixPosition(S.matrixWorld),A.position.applyMatrix4(f),A.direction.setFromMatrixPosition(S.matrixWorld),r.setFromMatrixPosition(S.target.matrixWorld),A.direction.sub(r),A.direction.transformDirection(f),R++}else if(S.isRectAreaLight){const A=i.rectArea[E];A.position.setFromMatrixPosition(S.matrixWorld),A.position.applyMatrix4(f),o.identity(),a.copy(S.matrixWorld),a.premultiply(f),o.extractRotation(a),A.halfWidth.set(S.width*.5,0,0),A.halfHeight.set(0,S.height*.5,0),A.halfWidth.applyMatrix4(o),A.halfHeight.applyMatrix4(o),E++}else if(S.isPointLight){const A=i.point[v];A.position.setFromMatrixPosition(S.matrixWorld),A.position.applyMatrix4(f),v++}else if(S.isHemisphereLight){const A=i.hemi[u];A.direction.setFromMatrixPosition(S.matrixWorld),A.direction.transformDirection(f),u++}}}return{setup:s,setupView:c,state:i}}function na(e){const n=new Nu(e),t=[],i=[],r=[];function a(p){_.camera=p,t.length=0,i.length=0,r.length=0}function o(p){t.push(p)}function s(p){i.push(p)}function c(p){r.push(p)}function d(){n.setup(t)}function g(p){n.setupView(t,p)}const _={lightsArray:t,shadowsArray:i,lightProbeGridArray:r,camera:null,lights:n,transmissionRenderTarget:{},textureUnits:0};return{init:a,state:_,setupLights:d,setupLightsView:g,pushLight:o,pushShadow:s,pushLightProbeGrid:c}}function Fu(e){let n=new WeakMap;function t(r,a=0){const o=n.get(r);let s;return o===void 0?(s=new na(e),n.set(r,[s])):a>=o.length?(s=new na(e),o.push(s)):s=o[a],s}function i(){n=new WeakMap}return{get:t,dispose:i}}const Ou=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Bu=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,Gu=[new me(1,0,0),new me(-1,0,0),new me(0,1,0),new me(0,-1,0),new me(0,0,1),new me(0,0,-1)],Hu=[new me(0,-1,0),new me(0,-1,0),new me(0,0,1),new me(0,0,-1),new me(0,-1,0),new me(0,-1,0)],ia=new Et,Pn=new me,mi=new me;function Vu(e,n,t){let i=new fa;const r=new mt,a=new mt,o=new xt,s=new yo,c=new Io,d={},g=t.maxTextureSize,_={[vn]:At,[At]:vn,[Bt]:Bt},p=new Xt({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new mt},radius:{value:4}},vertexShader:Ou,fragmentShader:Bu}),v=p.clone();v.defines.HORIZONTAL_PASS=1;const R=new Tn;R.setAttribute("position",new nn(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const E=new et(R,p),u=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=kn;let f=this.type;this.render=function(M,C,m){if(u.enabled===!1||u.autoUpdate===!1&&u.needsUpdate===!1||M.length===0)return;this.type===No&&(Xe("WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead."),this.type=kn);const T=e.getRenderTarget(),U=e.getActiveCubeFace(),N=e.getActiveMipmapLevel(),B=e.state;B.setBlending(Wt),B.buffers.depth.getReversed()===!0?B.buffers.color.setClear(0,0,0,0):B.buffers.color.setClear(1,1,1,1),B.buffers.depth.setTest(!0),B.setScissorTest(!1);const V=f!==this.type;V&&C.traverse(function(I){I.material&&(Array.isArray(I.material)?I.material.forEach(X=>X.needsUpdate=!0):I.material.needsUpdate=!0)});for(let I=0,X=M.length;I<X;I++){const Z=M[I],Y=Z.shadow;if(Y===void 0){Xe("WebGLShadowMap:",Z,"has no shadow.");continue}if(Y.autoUpdate===!1&&Y.needsUpdate===!1)continue;r.copy(Y.mapSize);const te=Y.getFrameExtents();r.multiply(te),a.copy(Y.mapSize),(r.x>g||r.y>g)&&(r.x>g&&(a.x=Math.floor(g/te.x),r.x=a.x*te.x,Y.mapSize.x=a.x),r.y>g&&(a.y=Math.floor(g/te.y),r.y=a.y*te.y,Y.mapSize.y=a.y));const $=e.state.buffers.depth.getReversed();if(Y.camera._reversedDepth=$,Y.map===null||V===!0){if(Y.map!==null&&(Y.map.depthTexture!==null&&(Y.map.depthTexture.dispose(),Y.map.depthTexture=null),Y.map.dispose()),this.type===Un){if(Z.isPointLight){Xe("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}Y.map=new Lt(r.x,r.y,{format:xn,type:zt,minFilter:vt,magFilter:vt,generateMipmaps:!1}),Y.map.texture.name=Z.name+".shadowMap",Y.map.depthTexture=new Yn(r.x,r.y,jt),Y.map.depthTexture.name=Z.name+".shadowMapDepth",Y.map.depthTexture.format=En,Y.map.depthTexture.compareFunction=null,Y.map.depthTexture.minFilter=Vt,Y.map.depthTexture.magFilter=Vt}else Z.isPointLight?(Y.map=new ka(r.x),Y.map.depthTexture=new Fo(r.x,on)):(Y.map=new Lt(r.x,r.y),Y.map.depthTexture=new Yn(r.x,r.y,on)),Y.map.depthTexture.name=Z.name+".shadowMap",Y.map.depthTexture.format=En,this.type===kn?(Y.map.depthTexture.compareFunction=$?Li:Di,Y.map.depthTexture.minFilter=vt,Y.map.depthTexture.magFilter=vt):(Y.map.depthTexture.compareFunction=null,Y.map.depthTexture.minFilter=Vt,Y.map.depthTexture.magFilter=Vt);Y.camera.updateProjectionMatrix()}Y.map.isWebGLCubeRenderTarget!==!0&&(Y.map.width!==r.x||Y.map.height!==r.y)&&Y.map.setSize(r.x,r.y);const J=Y.map.isWebGLCubeRenderTarget?6:Y.getViewportCount();Z.isPointLight!==!0&&Y.updateMatrices(Z,m);for(let ee=0;ee<J;ee++){const we=Y.getCamera(ee);if(Z.isPointLight){const Ce=Y.camera,ot=Y.matrix,Ke=Z.distance||Ce.far;Ke!==Ce.far&&(Ce.far=Ke,Ce.updateProjectionMatrix()),Pn.setFromMatrixPosition(Z.matrixWorld),Ce.position.copy(Pn),mi.copy(Ce.position),mi.add(Gu[ee]),Ce.up.copy(Hu[ee]),Ce.lookAt(mi),Ce.updateMatrixWorld(),ot.makeTranslation(-Pn.x,-Pn.y,-Pn.z),ia.multiplyMatrices(Ce.projectionMatrix,Ce.matrixWorldInverse),Y._frustum.setFromProjectionMatrix(ia,Ce.coordinateSystem,Ce.reversedDepth)}if(Y.map.isWebGLCubeRenderTarget)e.setRenderTarget(Y.map,ee),e.clear();else{ee===0&&(e.setRenderTarget(Y.map),e.clear());const Ce=Y.getViewport(ee);o.set(a.x*Ce.x,a.y*Ce.y,a.x*Ce.z,a.y*Ce.w),B.viewport(o)}i=Y.getFrustum(ee),S(C,m,we,Z,this.type)}Y.isPointLightShadow!==!0&&this.type===Un&&b(Y,m),Y.needsUpdate=!1}f=this.type,u.needsUpdate=!1,e.setRenderTarget(T,U,N)};function b(M,C){const m=n.update(E);p.defines.VSM_SAMPLES!==M.blurSamples&&(p.defines.VSM_SAMPLES=M.blurSamples,v.defines.VSM_SAMPLES=M.blurSamples,p.needsUpdate=!0,v.needsUpdate=!0),M.mapPass===null?M.mapPass=new Lt(r.x,r.y,{format:xn,type:zt}):(M.mapPass.width!==M.map.width||M.mapPass.height!==M.map.height)&&M.mapPass.setSize(M.map.width,M.map.height),p.uniforms.shadow_pass.value=M.map.depthTexture,p.uniforms.resolution.value.set(M.map.width,M.map.height),p.uniforms.radius.value=M.radius,e.setRenderTarget(M.mapPass),e.clear(),e.renderBufferDirect(C,null,m,p,E,null),v.uniforms.shadow_pass.value=M.mapPass.texture,v.uniforms.resolution.value.set(M.map.width,M.map.height),v.uniforms.radius.value=M.radius,e.setRenderTarget(M.map),e.clear(),e.renderBufferDirect(C,null,m,v,E,null)}function D(M,C,m,T){let U=null;const N=m.isPointLight===!0?M.customDistanceMaterial:M.customDepthMaterial;if(N!==void 0)U=N;else if(U=m.isPointLight===!0?c:s,e.localClippingEnabled&&C.clipShadows===!0&&Array.isArray(C.clippingPlanes)&&C.clippingPlanes.length!==0||C.displacementMap&&C.displacementScale!==0||C.alphaMap&&C.alphaTest>0||C.map&&C.alphaTest>0||C.alphaToCoverage===!0){const B=U.uuid,V=C.uuid;let I=d[B];I===void 0&&(I={},d[B]=I);let X=I[V];X===void 0&&(X=U.clone(),I[V]=X,C.addEventListener("dispose",A)),U=X}if(U.visible=C.visible,U.wireframe=C.wireframe,T===Un?U.side=C.shadowSide!==null?C.shadowSide:C.side:U.side=C.shadowSide!==null?C.shadowSide:_[C.side],U.alphaMap=C.alphaMap,U.alphaTest=C.alphaToCoverage===!0?.5:C.alphaTest,U.map=C.map,U.clipShadows=C.clipShadows,U.clippingPlanes=C.clippingPlanes,U.clipIntersection=C.clipIntersection,U.displacementMap=C.displacementMap,U.displacementScale=C.displacementScale,U.displacementBias=C.displacementBias,U.wireframeLinewidth=C.wireframeLinewidth,U.linewidth=C.linewidth,m.isPointLight===!0&&U.isMeshDistanceMaterial===!0){const B=e.properties.get(U);B.light=m}return U}function S(M,C,m,T,U){if(M.visible===!1)return;if(M.layers.test(C.layers)&&(M.isMesh||M.isLine||M.isPoints)&&(M.castShadow||M.receiveShadow&&U===Un)&&(!M.frustumCulled||M.intersectsFrustum(i))){M.modelViewMatrix.multiplyMatrices(m.matrixWorldInverse,M.matrixWorld);const V=n.update(M),I=M.material;if(Array.isArray(I)){const X=V.groups;for(let Z=0,Y=X.length;Z<Y;Z++){const te=X[Z],$=I[te.materialIndex];if($&&$.visible){const J=D(M,$,T,U);M.onBeforeShadow(e,M,C,m,V,J,te),e.renderBufferDirect(m,null,V,J,M,te),M.onAfterShadow(e,M,C,m,V,J,te)}}}else if(I.visible){const X=D(M,I,T,U);M.onBeforeShadow(e,M,C,m,V,X,null),e.renderBufferDirect(m,null,V,X,M,null),M.onAfterShadow(e,M,C,m,V,X,null)}}const B=M.children;for(let V=0,I=B.length;V<I;V++)S(B[V],C,m,T,U)}function A(M){M.target.removeEventListener("dispose",A);for(const m in d){const T=d[m],U=M.target.uuid;U in T&&(T[U].dispose(),delete T[U])}}}function ku(e,n){function t(){let P=!1;const oe=new xt;let K=null;const se=new xt(0,0,0,0);return{setMask:function(ue){K!==ue&&!P&&(e.colorMask(ue,ue,ue,ue),K=ue)},setLocked:function(ue){P=ue},setClear:function(ue,Q,Ae,Se,je){je===!0&&(ue*=Se,Q*=Se,Ae*=Se),oe.set(ue,Q,Ae,Se),se.equals(oe)===!1&&(e.clearColor(ue,Q,Ae,Se),se.copy(oe))},reset:function(){P=!1,K=null,se.set(-1,0,0,0)}}}function i(){let P=!1,oe=!1,K=null,se=null,ue=null;return{setReversed:function(Q){if(oe!==Q){const Ae=n.get("EXT_clip_control");Q?Ae.clipControlEXT(Ae.LOWER_LEFT_EXT,Ae.ZERO_TO_ONE_EXT):Ae.clipControlEXT(Ae.LOWER_LEFT_EXT,Ae.NEGATIVE_ONE_TO_ONE_EXT),oe=Q;const Se=ue;ue=null,this.setClear(Se)}},getReversed:function(){return oe},setTest:function(Q){Q?j(e.DEPTH_TEST):Ee(e.DEPTH_TEST)},setMask:function(Q){K!==Q&&!P&&(e.depthMask(Q),K=Q)},setFunc:function(Q){if(oe&&(Q=vs[Q]),se!==Q){switch(Q){case $o:e.depthFunc(e.NEVER);break;case Zo:e.depthFunc(e.ALWAYS);break;case Yo:e.depthFunc(e.LESS);break;case Ki:e.depthFunc(e.LEQUAL);break;case qo:e.depthFunc(e.EQUAL);break;case Ko:e.depthFunc(e.GEQUAL);break;case Xo:e.depthFunc(e.GREATER);break;case zo:e.depthFunc(e.NOTEQUAL);break;default:e.depthFunc(e.LEQUAL)}se=Q}},setLocked:function(Q){P=Q},setClear:function(Q){ue!==Q&&(ue=Q,oe&&(Q=1-Q),e.clearDepth(Q))},reset:function(){P=!1,K=null,se=null,ue=null,oe=!1}}}function r(){let P=!1,oe=null,K=null,se=null,ue=null,Q=null,Ae=null,Se=null,je=null;return{setTest:function(ke){P||(ke?j(e.STENCIL_TEST):Ee(e.STENCIL_TEST))},setMask:function(ke){oe!==ke&&!P&&(e.stencilMask(ke),oe=ke)},setFunc:function(ke,wt,Ut){(K!==ke||se!==wt||ue!==Ut)&&(e.stencilFunc(ke,wt,Ut),K=ke,se=wt,ue=Ut)},setOp:function(ke,wt,Ut){(Q!==ke||Ae!==wt||Se!==Ut)&&(e.stencilOp(ke,wt,Ut),Q=ke,Ae=wt,Se=Ut)},setLocked:function(ke){P=ke},setClear:function(ke){je!==ke&&(e.clearStencil(ke),je=ke)},reset:function(){P=!1,oe=null,K=null,se=null,ue=null,Q=null,Ae=null,Se=null,je=null}}}const a=new t,o=new i,s=new r,c=new WeakMap,d=new WeakMap;let g={},_={},p={},v=new WeakMap,R=[],E=null,u=!1,f=null,b=null,D=null,S=null,A=null,M=null,C=null,m=new Ve(0,0,0),T=0,U=!1,N=null,B=null,V=null,I=null,X=null;const Z=e.getParameter(e.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let Y=!1,te=0;const $=e.getParameter(e.VERSION);$.indexOf("WebGL")!==-1?(te=parseFloat(/^WebGL (\d)/.exec($)[1]),Y=te>=1):$.indexOf("OpenGL ES")!==-1&&(te=parseFloat(/^OpenGL ES (\d)/.exec($)[1]),Y=te>=2);let J=null,ee={};const we=e.getParameter(e.SCISSOR_BOX),Ce=e.getParameter(e.VIEWPORT),ot=new xt().fromArray(we),Ke=new xt().fromArray(Ce);function qe(P,oe,K,se){const ue=new Uint8Array(4),Q=e.createTexture();e.bindTexture(P,Q),e.texParameteri(P,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(P,e.TEXTURE_MAG_FILTER,e.NEAREST);for(let Ae=0;Ae<K;Ae++)P===e.TEXTURE_3D||P===e.TEXTURE_2D_ARRAY?e.texImage3D(oe,0,e.RGBA,1,1,se,0,e.RGBA,e.UNSIGNED_BYTE,ue):e.texImage2D(oe+Ae,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,ue);return Q}const z={};z[e.TEXTURE_2D]=qe(e.TEXTURE_2D,e.TEXTURE_2D,1),z[e.TEXTURE_CUBE_MAP]=qe(e.TEXTURE_CUBE_MAP,e.TEXTURE_CUBE_MAP_POSITIVE_X,6),z[e.TEXTURE_2D_ARRAY]=qe(e.TEXTURE_2D_ARRAY,e.TEXTURE_2D_ARRAY,1,1),z[e.TEXTURE_3D]=qe(e.TEXTURE_3D,e.TEXTURE_3D,1,1),a.setClear(0,0,0,1),o.setClear(1),s.setClear(0),j(e.DEPTH_TEST),o.setFunc(Ki),Fe(!1),rt(Yi),j(e.CULL_FACE),He(Wt);function j(P){g[P]!==!0&&(e.enable(P),g[P]=!0)}function Ee(P){g[P]!==!1&&(e.disable(P),g[P]=!1)}function Ue(P,oe){return p[P]!==oe?(e.bindFramebuffer(P,oe),p[P]=oe,P===e.DRAW_FRAMEBUFFER&&(p[e.FRAMEBUFFER]=oe),P===e.FRAMEBUFFER&&(p[e.DRAW_FRAMEBUFFER]=oe),!0):!1}function _e(P,oe){let K=R,se=!1;if(P){K=v.get(oe),K===void 0&&(K=[],v.set(oe,K));const ue=P.textures;if(K.length!==ue.length||K[0]!==e.COLOR_ATTACHMENT0){for(let Q=0,Ae=ue.length;Q<Ae;Q++)K[Q]=e.COLOR_ATTACHMENT0+Q;K.length=ue.length,se=!0}}else K[0]!==e.BACK&&(K[0]=e.BACK,se=!0);se&&e.drawBuffers(K)}function Be(P){return E!==P?(e.useProgram(P),E=P,!0):!1}const dt={[Rn]:e.FUNC_ADD,[fo]:e.FUNC_SUBTRACT,[lo]:e.FUNC_REVERSE_SUBTRACT};dt[Ss]=e.MIN,dt[xs]=e.MAX;const Ie={[bo]:e.ZERO,[Ro]:e.ONE,[Ao]:e.SRC_COLOR,[To]:e.SRC_ALPHA,[Mo]:e.SRC_ALPHA_SATURATE,[Eo]:e.DST_COLOR,[xo]:e.DST_ALPHA,[So]:e.ONE_MINUS_SRC_COLOR,[vo]:e.ONE_MINUS_SRC_ALPHA,[go]:e.ONE_MINUS_DST_COLOR,[_o]:e.ONE_MINUS_DST_ALPHA,[mo]:e.CONSTANT_COLOR,[ho]:e.ONE_MINUS_CONSTANT_COLOR,[po]:e.CONSTANT_ALPHA,[uo]:e.ONE_MINUS_CONSTANT_ALPHA};function He(P,oe,K,se,ue,Q,Ae,Se,je,ke){if(P===Wt){u===!0&&(Ee(e.BLEND),u=!1);return}if(u===!1&&(j(e.BLEND),u=!0),P!==Jo){if(P!==f||ke!==U){if((b!==Rn||A!==Rn)&&(e.blendEquation(e.FUNC_ADD),b=Rn,A=Rn),ke)switch(P){case Wn:e.blendFuncSeparate(e.ONE,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case ji:e.blendFunc(e.ONE,e.ONE);break;case $i:e.blendFuncSeparate(e.ZERO,e.ONE_MINUS_SRC_COLOR,e.ZERO,e.ONE);break;case Zi:e.blendFuncSeparate(e.DST_COLOR,e.ONE_MINUS_SRC_ALPHA,e.ZERO,e.ONE);break;default:nt("WebGLState: Invalid blending: ",P);break}else switch(P){case Wn:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case ji:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE,e.ONE,e.ONE);break;case $i:nt("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case Zi:nt("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:nt("WebGLState: Invalid blending: ",P);break}D=null,S=null,M=null,C=null,m.set(0,0,0),T=0,f=P,U=ke}return}ue=ue||oe,Q=Q||K,Ae=Ae||se,(oe!==b||ue!==A)&&(e.blendEquationSeparate(dt[oe],dt[ue]),b=oe,A=ue),(K!==D||se!==S||Q!==M||Ae!==C)&&(e.blendFuncSeparate(Ie[K],Ie[se],Ie[Q],Ie[Ae]),D=K,S=se,M=Q,C=Ae),(Se.equals(m)===!1||je!==T)&&(e.blendColor(Se.r,Se.g,Se.b,je),m.copy(Se),T=je),f=P,U=!1}function $e(P,oe){P.side===Bt?Ee(e.CULL_FACE):j(e.CULL_FACE);let K=P.side===At;oe&&(K=!K),Fe(K),P.blending===Wn&&P.transparent===!1?He(Wt):He(P.blending,P.blendEquation,P.blendSrc,P.blendDst,P.blendEquationAlpha,P.blendSrcAlpha,P.blendDstAlpha,P.blendColor,P.blendAlpha,P.premultipliedAlpha),o.setFunc(P.depthFunc),o.setTest(P.depthTest),o.setMask(P.depthWrite),a.setMask(P.colorWrite);const se=P.stencilWrite;s.setTest(se),se&&(s.setMask(P.stencilWriteMask),s.setFunc(P.stencilFunc,P.stencilRef,P.stencilFuncMask),s.setOp(P.stencilFail,P.stencilZFail,P.stencilZPass)),Mt(P.polygonOffset,P.polygonOffsetFactor,P.polygonOffsetUnits),P.alphaToCoverage===!0?j(e.SAMPLE_ALPHA_TO_COVERAGE):Ee(e.SAMPLE_ALPHA_TO_COVERAGE)}function Fe(P){N!==P&&(P?e.frontFace(e.CW):e.frontFace(e.CCW),N=P)}function rt(P){P!==jo?(j(e.CULL_FACE),P!==B&&(P===Yi?e.cullFace(e.BACK):P===Qo?e.cullFace(e.FRONT):e.cullFace(e.FRONT_AND_BACK))):Ee(e.CULL_FACE),B=P}function ht(P){P!==V&&(Y&&e.lineWidth(P),V=P)}function Mt(P,oe,K){P?(j(e.POLYGON_OFFSET_FILL),(I!==oe||X!==K)&&(I=oe,X=K,o.getReversed()&&(oe=-oe),e.polygonOffset(oe,K))):Ee(e.POLYGON_OFFSET_FILL)}function at(P){P?j(e.SCISSOR_TEST):Ee(e.SCISSOR_TEST)}function lt(P){P===void 0&&(P=e.TEXTURE0+Z-1),J!==P&&(e.activeTexture(P),J=P)}function L(P,oe,K){K===void 0&&(J===null?K=e.TEXTURE0+Z-1:K=J);let se=ee[K];se===void 0&&(se={type:void 0,texture:void 0},ee[K]=se),(se.type!==P||se.texture!==oe)&&(J!==K&&(e.activeTexture(K),J=K),e.bindTexture(P,oe||z[P]),se.type=P,se.texture=oe)}function _t(){const P=ee[J];P!==void 0&&P.type!==void 0&&(e.bindTexture(P.type,null),P.type=void 0,P.texture=void 0)}function ze(){try{e.compressedTexImage2D(...arguments)}catch(P){nt("WebGLState:",P)}}function x(){try{e.compressedTexImage3D(...arguments)}catch(P){nt("WebGLState:",P)}}function l(){try{e.texSubImage2D(...arguments)}catch(P){nt("WebGLState:",P)}}function y(){try{e.texSubImage3D(...arguments)}catch(P){nt("WebGLState:",P)}}function G(){try{e.compressedTexSubImage2D(...arguments)}catch(P){nt("WebGLState:",P)}}function k(){try{e.compressedTexSubImage3D(...arguments)}catch(P){nt("WebGLState:",P)}}function ne(){try{e.texStorage2D(...arguments)}catch(P){nt("WebGLState:",P)}}function ie(){try{e.texStorage3D(...arguments)}catch(P){nt("WebGLState:",P)}}function W(){try{e.texImage2D(...arguments)}catch(P){nt("WebGLState:",P)}}function q(){try{e.texImage3D(...arguments)}catch(P){nt("WebGLState:",P)}}function re(P){return _[P]!==void 0?_[P]:e.getParameter(P)}function Me(P,oe){_[P]!==oe&&(e.pixelStorei(P,oe),_[P]=oe)}function ce(P){ot.equals(P)===!1&&(e.scissor(P.x,P.y,P.z,P.w),ot.copy(P))}function ae(P){Ke.equals(P)===!1&&(e.viewport(P.x,P.y,P.z,P.w),Ke.copy(P))}function Te(P,oe){let K=d.get(oe);K===void 0&&(K=new WeakMap,d.set(oe,K));let se=K.get(P);se===void 0&&(se=e.getUniformBlockIndex(oe,P.name),K.set(P,se))}function be(P,oe){const se=d.get(oe).get(P);c.get(oe)!==se&&(e.uniformBlockBinding(oe,se,P.__bindingPointIndex),c.set(oe,se))}function Pe(){e.disable(e.BLEND),e.disable(e.CULL_FACE),e.disable(e.DEPTH_TEST),e.disable(e.POLYGON_OFFSET_FILL),e.disable(e.SCISSOR_TEST),e.disable(e.STENCIL_TEST),e.disable(e.SAMPLE_ALPHA_TO_COVERAGE),e.blendEquation(e.FUNC_ADD),e.blendFunc(e.ONE,e.ZERO),e.blendFuncSeparate(e.ONE,e.ZERO,e.ONE,e.ZERO),e.blendColor(0,0,0,0),e.colorMask(!0,!0,!0,!0),e.clearColor(0,0,0,0),e.depthMask(!0),e.depthFunc(e.LESS),o.setReversed(!1),e.clearDepth(1),e.stencilMask(4294967295),e.stencilFunc(e.ALWAYS,0,4294967295),e.stencilOp(e.KEEP,e.KEEP,e.KEEP),e.clearStencil(0),e.cullFace(e.BACK),e.frontFace(e.CCW),e.polygonOffset(0,0),e.activeTexture(e.TEXTURE0),e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),e.bindFramebuffer(e.READ_FRAMEBUFFER,null),e.useProgram(null),e.lineWidth(1),e.scissor(0,0,e.canvas.width,e.canvas.height),e.viewport(0,0,e.canvas.width,e.canvas.height),e.pixelStorei(e.PACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,e.BROWSER_DEFAULT_WEBGL),e.pixelStorei(e.PACK_ROW_LENGTH,0),e.pixelStorei(e.PACK_SKIP_PIXELS,0),e.pixelStorei(e.PACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_ROW_LENGTH,0),e.pixelStorei(e.UNPACK_IMAGE_HEIGHT,0),e.pixelStorei(e.UNPACK_SKIP_PIXELS,0),e.pixelStorei(e.UNPACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_SKIP_IMAGES,0),g={},_={},J=null,ee={},p={},v=new WeakMap,R=[],E=null,u=!1,f=null,b=null,D=null,S=null,A=null,M=null,C=null,m=new Ve(0,0,0),T=0,U=!1,N=null,B=null,V=null,I=null,X=null,ot.set(0,0,e.canvas.width,e.canvas.height),Ke.set(0,0,e.canvas.width,e.canvas.height),a.reset(),o.reset(),s.reset()}return{buffers:{color:a,depth:o,stencil:s},enable:j,disable:Ee,bindFramebuffer:Ue,drawBuffers:_e,useProgram:Be,setBlending:He,setMaterial:$e,setFlipSided:Fe,setCullFace:rt,setLineWidth:ht,setPolygonOffset:Mt,setScissorTest:at,activeTexture:lt,bindTexture:L,unbindTexture:_t,compressedTexImage2D:ze,compressedTexImage3D:x,texImage2D:W,texImage3D:q,pixelStorei:Me,getParameter:re,updateUBOMapping:Te,uniformBlockBinding:be,texStorage2D:ne,texStorage3D:ie,texSubImage2D:l,texSubImage3D:y,compressedTexSubImage2D:G,compressedTexSubImage3D:k,scissor:ce,viewport:ae,reset:Pe}}function Wu(e,n,t,i,r,a,o){const s=n.has("WEBGL_multisampled_render_to_texture")?n.get("WEBGL_multisampled_render_to_texture"):null,c=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),d=new mt,g=new WeakMap,_=new Set;let p;const v=new WeakMap;let R=!1;try{R=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function E(x,l){return R?new OffscreenCanvas(x,l):ps("canvas")}function u(x,l,y){let G=1;const k=ze(x);if((k.width>y||k.height>y)&&(G=y/Math.max(k.width,k.height)),G<1)if(typeof HTMLImageElement<"u"&&x instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&x instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&x instanceof ImageBitmap||typeof VideoFrame<"u"&&x instanceof VideoFrame){const ne=Math.floor(G*k.width),ie=Math.floor(G*k.height);p===void 0&&(p=E(ne,ie));const W=l?E(ne,ie):p;return W.width=ne,W.height=ie,W.getContext("2d").drawImage(x,0,0,ne,ie),Xe("WebGLRenderer: Texture has been resized from ("+k.width+"x"+k.height+") to ("+ne+"x"+ie+")."),W}else return"data"in x&&Xe("WebGLRenderer: Image in DataTexture is too big ("+k.width+"x"+k.height+")."),x;return x}function f(x){return x.generateMipmaps}function b(x){e.generateMipmap(x)}function D(x){return x.isWebGLCubeRenderTarget?e.TEXTURE_CUBE_MAP:x.isWebGL3DRenderTarget?e.TEXTURE_3D:x.isWebGLArrayRenderTarget||x.isCompressedArrayTexture?e.TEXTURE_2D_ARRAY:e.TEXTURE_2D}function S(x,l,y,G,k,ne=!1){if(x!==null){if(e[x]!==void 0)return e[x];Xe("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+x+"'")}let ie;G&&(ie=n.get("EXT_texture_norm16"),ie||Xe("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let W=l;if(l===e.RED&&(y===e.FLOAT&&(W=e.R32F),y===e.HALF_FLOAT&&(W=e.R16F),y===e.UNSIGNED_BYTE&&(W=e.R8),y===e.UNSIGNED_SHORT&&ie&&(W=ie.R16_EXT),y===e.SHORT&&ie&&(W=ie.R16_SNORM_EXT)),l===e.RED_INTEGER&&(y===e.UNSIGNED_BYTE&&(W=e.R8UI),y===e.UNSIGNED_SHORT&&(W=e.R16UI),y===e.UNSIGNED_INT&&(W=e.R32UI),y===e.BYTE&&(W=e.R8I),y===e.SHORT&&(W=e.R16I),y===e.INT&&(W=e.R32I)),l===e.RG&&(y===e.FLOAT&&(W=e.RG32F),y===e.HALF_FLOAT&&(W=e.RG16F),y===e.UNSIGNED_BYTE&&(W=e.RG8),y===e.UNSIGNED_SHORT&&ie&&(W=ie.RG16_EXT),y===e.SHORT&&ie&&(W=ie.RG16_SNORM_EXT)),l===e.RG_INTEGER&&(y===e.UNSIGNED_BYTE&&(W=e.RG8UI),y===e.UNSIGNED_SHORT&&(W=e.RG16UI),y===e.UNSIGNED_INT&&(W=e.RG32UI),y===e.BYTE&&(W=e.RG8I),y===e.SHORT&&(W=e.RG16I),y===e.INT&&(W=e.RG32I)),l===e.RGB_INTEGER&&(y===e.UNSIGNED_BYTE&&(W=e.RGB8UI),y===e.UNSIGNED_SHORT&&(W=e.RGB16UI),y===e.UNSIGNED_INT&&(W=e.RGB32UI),y===e.BYTE&&(W=e.RGB8I),y===e.SHORT&&(W=e.RGB16I),y===e.INT&&(W=e.RGB32I)),l===e.RGBA_INTEGER&&(y===e.UNSIGNED_BYTE&&(W=e.RGBA8UI),y===e.UNSIGNED_SHORT&&(W=e.RGBA16UI),y===e.UNSIGNED_INT&&(W=e.RGBA32UI),y===e.BYTE&&(W=e.RGBA8I),y===e.SHORT&&(W=e.RGBA16I),y===e.INT&&(W=e.RGBA32I)),l===e.RGB&&(y===e.UNSIGNED_SHORT&&ie&&(W=ie.RGB16_EXT),y===e.SHORT&&ie&&(W=ie.RGB16_SNORM_EXT),y===e.UNSIGNED_INT_5_9_9_9_REV&&(W=e.RGB9_E5),y===e.UNSIGNED_INT_10F_11F_11F_REV&&(W=e.R11F_G11F_B10F)),l===e.RGBA){const q=ne?Aa:it.getTransfer(k);y===e.FLOAT&&(W=e.RGBA32F),y===e.HALF_FLOAT&&(W=e.RGBA16F),y===e.UNSIGNED_BYTE&&(W=q===Je?e.SRGB8_ALPHA8:e.RGBA8),y===e.UNSIGNED_SHORT&&ie&&(W=ie.RGBA16_EXT),y===e.SHORT&&ie&&(W=ie.RGBA16_SNORM_EXT),y===e.UNSIGNED_SHORT_4_4_4_4&&(W=e.RGBA4),y===e.UNSIGNED_SHORT_5_5_5_1&&(W=e.RGB5_A1)}return(W===e.R16F||W===e.R32F||W===e.RG16F||W===e.RG32F||W===e.RGBA16F||W===e.RGBA32F)&&n.get("EXT_color_buffer_float"),W}function A(x,l){let y;return x?l===null||l===on||l===Fn?y=e.DEPTH24_STENCIL8:l===jt?y=e.DEPTH32F_STENCIL8:l===Zn&&(y=e.DEPTH24_STENCIL8,Xe("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):l===null||l===on||l===Fn?y=e.DEPTH_COMPONENT24:l===jt?y=e.DEPTH_COMPONENT32F:l===Zn&&(y=e.DEPTH_COMPONENT16),y}function M(x,l){return f(x)===!0||x.isFramebufferTexture&&x.minFilter!==Vt&&x.minFilter!==vt?Math.log2(Math.max(l.width,l.height))+1:x.mipmaps!==void 0&&x.mipmaps.length>0?x.mipmaps.length:x.isCompressedTexture&&Array.isArray(x.image)?l.mipmaps.length:1}function C(x){const l=x.target;l.removeEventListener("dispose",C),T(l),l.isVideoTexture&&g.delete(l),l.isHTMLTexture&&_.delete(l)}function m(x){const l=x.target;l.removeEventListener("dispose",m),N(l)}function T(x){const l=i.get(x);if(l.__webglInit===void 0)return;const y=x.source,G=v.get(y);if(G){const k=G[l.__cacheKey];k.usedTimes--,k.usedTimes===0&&U(x),Object.keys(G).length===0&&v.delete(y)}i.remove(x)}function U(x){const l=i.get(x);e.deleteTexture(l.__webglTexture);const y=x.source,G=v.get(y);delete G[l.__cacheKey],o.memory.textures--}function N(x){const l=i.get(x);if(x.depthTexture&&(x.depthTexture.dispose(),i.remove(x.depthTexture)),x.isWebGLCubeRenderTarget)for(let G=0;G<6;G++){if(Array.isArray(l.__webglFramebuffer[G]))for(let k=0;k<l.__webglFramebuffer[G].length;k++)e.deleteFramebuffer(l.__webglFramebuffer[G][k]);else e.deleteFramebuffer(l.__webglFramebuffer[G]);l.__webglDepthbuffer&&e.deleteRenderbuffer(l.__webglDepthbuffer[G])}else{if(Array.isArray(l.__webglFramebuffer))for(let G=0;G<l.__webglFramebuffer.length;G++)e.deleteFramebuffer(l.__webglFramebuffer[G]);else e.deleteFramebuffer(l.__webglFramebuffer);if(l.__webglDepthbuffer&&e.deleteRenderbuffer(l.__webglDepthbuffer),l.__webglMultisampledFramebuffer&&e.deleteFramebuffer(l.__webglMultisampledFramebuffer),l.__webglColorRenderbuffer)for(let G=0;G<l.__webglColorRenderbuffer.length;G++)l.__webglColorRenderbuffer[G]&&e.deleteRenderbuffer(l.__webglColorRenderbuffer[G]);l.__webglDepthRenderbuffer&&e.deleteRenderbuffer(l.__webglDepthRenderbuffer)}const y=x.textures;for(let G=0,k=y.length;G<k;G++){const ne=i.get(y[G]);ne.__webglTexture&&(e.deleteTexture(ne.__webglTexture),o.memory.textures--),i.remove(y[G])}i.remove(x)}let B=0;function V(){B=0}function I(){return B}function X(x){B=x}function Z(){const x=B;return x>=r.maxTextures&&Xe("WebGLTextures: Trying to use "+(x+1)+" texture units while this GPU supports only "+r.maxTextures),B+=1,x}function Y(x){const l=[];return l.push(x.wrapS),l.push(x.wrapT),l.push(x.wrapR||0),l.push(x.magFilter),l.push(x.minFilter),l.push(x.anisotropy),l.push(x.internalFormat),l.push(x.format),l.push(x.type),l.push(x.generateMipmaps),l.push(x.premultiplyAlpha),l.push(x.flipY),l.push(x.unpackAlignment),l.push(x.colorSpace),l.join()}function te(x,l){const y=i.get(x);if(x.isVideoTexture&&L(x),x.isRenderTargetTexture===!1&&x.isExternalTexture!==!0&&x.version>0&&y.__version!==x.version){const G=x.image;if(G===null)Xe("WebGLRenderer: Texture marked for update but no image data found.");else if(G.complete===!1)Xe("WebGLRenderer: Texture marked for update but image is incomplete");else{Ee(y,x,l);return}}else x.isExternalTexture&&(y.__webglTexture=x.sourceTexture?x.sourceTexture:null);t.bindTexture(e.TEXTURE_2D,y.__webglTexture,e.TEXTURE0+l)}function $(x,l){const y=i.get(x);if(x.isRenderTargetTexture===!1&&x.version>0&&y.__version!==x.version){Ee(y,x,l);return}else x.isExternalTexture&&(y.__webglTexture=x.sourceTexture?x.sourceTexture:null);t.bindTexture(e.TEXTURE_2D_ARRAY,y.__webglTexture,e.TEXTURE0+l)}function J(x,l){const y=i.get(x);if(x.isRenderTargetTexture===!1&&x.version>0&&y.__version!==x.version){Ee(y,x,l);return}t.bindTexture(e.TEXTURE_3D,y.__webglTexture,e.TEXTURE0+l)}function ee(x,l){const y=i.get(x);if(x.isCubeDepthTexture!==!0&&x.version>0&&y.__version!==x.version){Ue(y,x,l);return}t.bindTexture(e.TEXTURE_CUBE_MAP,y.__webglTexture,e.TEXTURE0+l)}const we={[qn]:e.REPEAT,[Kn]:e.CLAMP_TO_EDGE,[da]:e.MIRRORED_REPEAT},Ce={[Vt]:e.NEAREST,[ua]:e.NEAREST_MIPMAP_NEAREST,[Dn]:e.NEAREST_MIPMAP_LINEAR,[vt]:e.LINEAR,[Vn]:e.LINEAR_MIPMAP_NEAREST,[$t]:e.LINEAR_MIPMAP_LINEAR},ot={[Uo]:e.NEVER,[Do]:e.ALWAYS,[Lo]:e.LESS,[Di]:e.LEQUAL,[Po]:e.EQUAL,[Li]:e.GEQUAL,[wo]:e.GREATER,[Co]:e.NOTEQUAL};function Ke(x,l){if(l.type===jt&&n.has("OES_texture_float_linear")===!1&&(l.magFilter===vt||l.magFilter===Vn||l.magFilter===Dn||l.magFilter===$t||l.minFilter===vt||l.minFilter===Vn||l.minFilter===Dn||l.minFilter===$t)&&Xe("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),e.texParameteri(x,e.TEXTURE_WRAP_S,we[l.wrapS]),e.texParameteri(x,e.TEXTURE_WRAP_T,we[l.wrapT]),(x===e.TEXTURE_3D||x===e.TEXTURE_2D_ARRAY)&&e.texParameteri(x,e.TEXTURE_WRAP_R,we[l.wrapR]),e.texParameteri(x,e.TEXTURE_MAG_FILTER,Ce[l.magFilter]),e.texParameteri(x,e.TEXTURE_MIN_FILTER,Ce[l.minFilter]),l.compareFunction&&(e.texParameteri(x,e.TEXTURE_COMPARE_MODE,e.COMPARE_REF_TO_TEXTURE),e.texParameteri(x,e.TEXTURE_COMPARE_FUNC,ot[l.compareFunction])),n.has("EXT_texture_filter_anisotropic")===!0){if(l.magFilter===Vt||l.minFilter!==Dn&&l.minFilter!==$t||l.type===jt&&n.has("OES_texture_float_linear")===!1)return;if(l.anisotropy>1||i.get(l).__currentAnisotropy){const y=n.get("EXT_texture_filter_anisotropic");e.texParameterf(x,y.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(l.anisotropy,r.getMaxAnisotropy())),i.get(l).__currentAnisotropy=l.anisotropy}}}function qe(x,l){let y=!1;x.__webglInit===void 0&&(x.__webglInit=!0,l.addEventListener("dispose",C));const G=l.source;let k=v.get(G);k===void 0&&(k={},v.set(G,k));const ne=Y(l);if(ne!==x.__cacheKey){k[ne]===void 0&&(k[ne]={texture:e.createTexture(),usedTimes:0},o.memory.textures++,y=!0),k[ne].usedTimes++;const ie=k[x.__cacheKey];ie!==void 0&&(k[x.__cacheKey].usedTimes--,ie.usedTimes===0&&U(l)),x.__cacheKey=ne,x.__webglTexture=k[ne].texture}return y}function z(x,l,y){return Math.floor(Math.floor(x/y)/l)}function j(x,l,y,G){const ne=x.updateRanges;if(ne.length===0)t.texSubImage2D(e.TEXTURE_2D,0,0,0,l.width,l.height,y,G,l.data);else{ne.sort((Me,ce)=>Me.start-ce.start);let ie=0;for(let Me=1;Me<ne.length;Me++){const ce=ne[ie],ae=ne[Me],Te=ce.start+ce.count,be=z(ae.start,l.width,4),Pe=z(ce.start,l.width,4);ae.start<=Te+1&&be===Pe&&z(ae.start+ae.count-1,l.width,4)===be?ce.count=Math.max(ce.count,ae.start+ae.count-ce.start):(++ie,ne[ie]=ae)}ne.length=ie+1;const W=t.getParameter(e.UNPACK_ROW_LENGTH),q=t.getParameter(e.UNPACK_SKIP_PIXELS),re=t.getParameter(e.UNPACK_SKIP_ROWS);t.pixelStorei(e.UNPACK_ROW_LENGTH,l.width);for(let Me=0,ce=ne.length;Me<ce;Me++){const ae=ne[Me],Te=Math.floor(ae.start/4),be=Math.ceil(ae.count/4),Pe=Te%l.width,P=Math.floor(Te/l.width),oe=be,K=1;t.pixelStorei(e.UNPACK_SKIP_PIXELS,Pe),t.pixelStorei(e.UNPACK_SKIP_ROWS,P),t.texSubImage2D(e.TEXTURE_2D,0,Pe,P,oe,K,y,G,l.data)}x.clearUpdateRanges(),t.pixelStorei(e.UNPACK_ROW_LENGTH,W),t.pixelStorei(e.UNPACK_SKIP_PIXELS,q),t.pixelStorei(e.UNPACK_SKIP_ROWS,re)}}function Ee(x,l,y){let G=e.TEXTURE_2D;(l.isDataArrayTexture||l.isCompressedArrayTexture)&&(G=e.TEXTURE_2D_ARRAY),l.isData3DTexture&&(G=e.TEXTURE_3D);const k=qe(x,l),ne=l.source;t.bindTexture(G,x.__webglTexture,e.TEXTURE0+y);const ie=i.get(ne);if(ne.version!==ie.__version||k===!0){if(t.activeTexture(e.TEXTURE0+y),(typeof ImageBitmap<"u"&&l.image instanceof ImageBitmap)===!1){const K=it.getPrimaries(it.workingColorSpace),se=l.colorSpace===dn?null:it.getPrimaries(l.colorSpace),ue=l.colorSpace===dn||K===se?e.NONE:e.BROWSER_DEFAULT_WEBGL;t.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,l.flipY),t.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,l.premultiplyAlpha),t.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,ue)}t.pixelStorei(e.UNPACK_ALIGNMENT,l.unpackAlignment);let q=u(l.image,!1,r.maxTextureSize);q=_t(l,q);const re=a.convert(l.format,l.colorSpace),Me=a.convert(l.type);let ce=S(l.internalFormat,re,Me,l.normalized,l.colorSpace,l.isVideoTexture);Ke(G,l);let ae;const Te=l.mipmaps,be=l.isVideoTexture!==!0,Pe=ie.__version===void 0||k===!0,P=ne.dataReady,oe=M(l,q);if(l.isDepthTexture)ce=A(l.format===pn,l.type),Pe&&(be?t.texStorage2D(e.TEXTURE_2D,1,ce,q.width,q.height):t.texImage2D(e.TEXTURE_2D,0,ce,q.width,q.height,0,re,Me,null));else if(l.isDataTexture)if(Te.length>0){be&&Pe&&t.texStorage2D(e.TEXTURE_2D,oe,ce,Te[0].width,Te[0].height);for(let K=0,se=Te.length;K<se;K++)ae=Te[K],be?P&&t.texSubImage2D(e.TEXTURE_2D,K,0,0,ae.width,ae.height,re,Me,ae.data):t.texImage2D(e.TEXTURE_2D,K,ce,ae.width,ae.height,0,re,Me,ae.data);l.generateMipmaps=!1}else be?(Pe&&t.texStorage2D(e.TEXTURE_2D,oe,ce,q.width,q.height),P&&j(l,q,re,Me)):t.texImage2D(e.TEXTURE_2D,0,ce,q.width,q.height,0,re,Me,q.data);else if(l.isCompressedTexture)if(l.isCompressedArrayTexture){be&&Pe&&t.texStorage3D(e.TEXTURE_2D_ARRAY,oe,ce,Te[0].width,Te[0].height,q.depth);for(let K=0,se=Te.length;K<se;K++)if(ae=Te[K],l.format!==kt)if(re!==null)if(be){if(P)if(l.layerUpdates.size>0){const ue=Pr(ae.width,ae.height,l.format,l.type);for(const Q of l.layerUpdates){const Ae=ae.data.subarray(Q*ue/ae.data.BYTES_PER_ELEMENT,(Q+1)*ue/ae.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,K,0,0,Q,ae.width,ae.height,1,re,Ae)}}else t.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,K,0,0,0,ae.width,ae.height,q.depth,re,ae.data)}else t.compressedTexImage3D(e.TEXTURE_2D_ARRAY,K,ce,ae.width,ae.height,q.depth,0,ae.data,0,0);else Xe("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else be?P&&t.texSubImage3D(e.TEXTURE_2D_ARRAY,K,0,0,0,ae.width,ae.height,q.depth,re,Me,ae.data):t.texImage3D(e.TEXTURE_2D_ARRAY,K,ce,ae.width,ae.height,q.depth,0,re,Me,ae.data);l.layerUpdates.size>0&&l.clearLayerUpdates()}else{be&&Pe&&t.texStorage2D(e.TEXTURE_2D,oe,ce,Te[0].width,Te[0].height);for(let K=0,se=Te.length;K<se;K++)ae=Te[K],l.format!==kt?re!==null?be?P&&t.compressedTexSubImage2D(e.TEXTURE_2D,K,0,0,ae.width,ae.height,re,ae.data):t.compressedTexImage2D(e.TEXTURE_2D,K,ce,ae.width,ae.height,0,ae.data):Xe("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):be?P&&t.texSubImage2D(e.TEXTURE_2D,K,0,0,ae.width,ae.height,re,Me,ae.data):t.texImage2D(e.TEXTURE_2D,K,ce,ae.width,ae.height,0,re,Me,ae.data)}else if(l.isDataArrayTexture)if(be){if(Pe&&t.texStorage3D(e.TEXTURE_2D_ARRAY,oe,ce,q.width,q.height,q.depth),P)if(l.layerUpdates.size>0){const K=Pr(q.width,q.height,l.format,l.type);for(const se of l.layerUpdates){const ue=q.data.subarray(se*K/q.data.BYTES_PER_ELEMENT,(se+1)*K/q.data.BYTES_PER_ELEMENT);t.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,se,q.width,q.height,1,re,Me,ue)}l.clearLayerUpdates()}else t.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,0,q.width,q.height,q.depth,re,Me,q.data)}else t.texImage3D(e.TEXTURE_2D_ARRAY,0,ce,q.width,q.height,q.depth,0,re,Me,q.data);else if(l.isData3DTexture)be?(Pe&&t.texStorage3D(e.TEXTURE_3D,oe,ce,q.width,q.height,q.depth),P&&t.texSubImage3D(e.TEXTURE_3D,0,0,0,0,q.width,q.height,q.depth,re,Me,q.data)):t.texImage3D(e.TEXTURE_3D,0,ce,q.width,q.height,q.depth,0,re,Me,q.data);else if(l.isFramebufferTexture){if(Pe)if(be)t.texStorage2D(e.TEXTURE_2D,oe,ce,q.width,q.height);else{let K=q.width,se=q.height;for(let ue=0;ue<oe;ue++)t.texImage2D(e.TEXTURE_2D,ue,ce,K,se,0,re,Me,null),K>>=1,se>>=1}}else if(l.isHTMLTexture){if("texElementImage2D"in e){const K=e.canvas;if(K.hasAttribute("layoutsubtree")||K.setAttribute("layoutsubtree","true"),q.parentNode!==K){K.appendChild(q),_.add(l),K.onpaint=se=>{const ue=se.changedElements;for(const Q of _)ue.includes(Q.image)&&(Q.needsUpdate=!0)},K.requestPaint();return}if(e.texElementImage2D.length===3)e.texElementImage2D(e.TEXTURE_2D,e.RGBA8,q);else{const ue=e.RGBA,Q=e.RGBA,Ae=e.UNSIGNED_BYTE;e.texElementImage2D(e.TEXTURE_2D,0,ue,Q,Ae,q)}e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE)}}else if(Te.length>0){if(be&&Pe){const K=ze(Te[0]);t.texStorage2D(e.TEXTURE_2D,oe,ce,K.width,K.height)}for(let K=0,se=Te.length;K<se;K++)ae=Te[K],be?P&&t.texSubImage2D(e.TEXTURE_2D,K,0,0,re,Me,ae):t.texImage2D(e.TEXTURE_2D,K,ce,re,Me,ae);l.generateMipmaps=!1}else if(be){if(Pe){const K=ze(q);t.texStorage2D(e.TEXTURE_2D,oe,ce,K.width,K.height)}P&&t.texSubImage2D(e.TEXTURE_2D,0,0,0,re,Me,q)}else t.texImage2D(e.TEXTURE_2D,0,ce,re,Me,q);f(l)&&b(G),ie.__version=ne.version,l.onUpdate&&l.onUpdate(l)}x.__version=l.version}function Ue(x,l,y){if(l.image.length!==6)return;const G=qe(x,l),k=l.source;t.bindTexture(e.TEXTURE_CUBE_MAP,x.__webglTexture,e.TEXTURE0+y);const ne=i.get(k);if(k.version!==ne.__version||G===!0){t.activeTexture(e.TEXTURE0+y);const ie=it.getPrimaries(it.workingColorSpace),W=l.colorSpace===dn?null:it.getPrimaries(l.colorSpace),q=l.colorSpace===dn||ie===W?e.NONE:e.BROWSER_DEFAULT_WEBGL;t.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,l.flipY),t.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,l.premultiplyAlpha),t.pixelStorei(e.UNPACK_ALIGNMENT,l.unpackAlignment),t.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,q);const re=l.isCompressedTexture||l.image[0].isCompressedTexture,Me=l.image[0]&&l.image[0].isDataTexture,ce=[];for(let Q=0;Q<6;Q++)!re&&!Me?ce[Q]=u(l.image[Q],!0,r.maxCubemapSize):ce[Q]=Me?l.image[Q].image:l.image[Q],ce[Q]=_t(l,ce[Q]);const ae=ce[0],Te=a.convert(l.format,l.colorSpace),be=a.convert(l.type),Pe=S(l.internalFormat,Te,be,l.normalized,l.colorSpace),P=l.isVideoTexture!==!0,oe=ne.__version===void 0||G===!0,K=k.dataReady;let se=M(l,ae);Ke(e.TEXTURE_CUBE_MAP,l);let ue;if(re){P&&oe&&t.texStorage2D(e.TEXTURE_CUBE_MAP,se,Pe,ae.width,ae.height);for(let Q=0;Q<6;Q++){ue=ce[Q].mipmaps;for(let Ae=0;Ae<ue.length;Ae++){const Se=ue[Ae];l.format!==kt?Te!==null?P?K&&t.compressedTexSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+Q,Ae,0,0,Se.width,Se.height,Te,Se.data):t.compressedTexImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+Q,Ae,Pe,Se.width,Se.height,0,Se.data):Xe("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):P?K&&t.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+Q,Ae,0,0,Se.width,Se.height,Te,be,Se.data):t.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+Q,Ae,Pe,Se.width,Se.height,0,Te,be,Se.data)}}}else{if(ue=l.mipmaps,P&&oe){ue.length>0&&se++;const Q=ze(ce[0]);t.texStorage2D(e.TEXTURE_CUBE_MAP,se,Pe,Q.width,Q.height)}for(let Q=0;Q<6;Q++)if(Me){P?K&&t.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+Q,0,0,0,ce[Q].width,ce[Q].height,Te,be,ce[Q].data):t.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+Q,0,Pe,ce[Q].width,ce[Q].height,0,Te,be,ce[Q].data);for(let Ae=0;Ae<ue.length;Ae++){const je=ue[Ae].image[Q].image;P?K&&t.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+Q,Ae+1,0,0,je.width,je.height,Te,be,je.data):t.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+Q,Ae+1,Pe,je.width,je.height,0,Te,be,je.data)}}else{P?K&&t.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+Q,0,0,0,Te,be,ce[Q]):t.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+Q,0,Pe,Te,be,ce[Q]);for(let Ae=0;Ae<ue.length;Ae++){const Se=ue[Ae];P?K&&t.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+Q,Ae+1,0,0,Te,be,Se.image[Q]):t.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+Q,Ae+1,Pe,Te,be,Se.image[Q])}}}f(l)&&b(e.TEXTURE_CUBE_MAP),ne.__version=k.version,l.onUpdate&&l.onUpdate(l)}x.__version=l.version}function _e(x,l,y,G,k,ne){const ie=a.convert(y.format,y.colorSpace),W=a.convert(y.type),q=S(y.internalFormat,ie,W,y.normalized,y.colorSpace),re=i.get(l),Me=i.get(y);if(Me.__renderTarget=l,!re.__hasExternalTextures){const ce=Math.max(1,l.width>>ne),ae=Math.max(1,l.height>>ne);k===e.TEXTURE_3D||k===e.TEXTURE_2D_ARRAY?t.texImage3D(k,ne,q,ce,ae,l.depth,0,ie,W,null):t.texImage2D(k,ne,q,ce,ae,0,ie,W,null)}t.bindFramebuffer(e.FRAMEBUFFER,x),lt(l)?s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,G,k,Me.__webglTexture,0,at(l)):(k===e.TEXTURE_2D||k>=e.TEXTURE_CUBE_MAP_POSITIVE_X&&k<=e.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&e.framebufferTexture2D(e.FRAMEBUFFER,G,k,Me.__webglTexture,ne),t.bindFramebuffer(e.FRAMEBUFFER,null)}function Be(x,l,y){if(e.bindRenderbuffer(e.RENDERBUFFER,x),l.depthBuffer){const G=l.depthTexture,k=G&&G.isDepthTexture?G.type:null,ne=A(l.stencilBuffer,k),ie=l.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;lt(l)?s.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,at(l),ne,l.width,l.height):y?e.renderbufferStorageMultisample(e.RENDERBUFFER,at(l),ne,l.width,l.height):e.renderbufferStorage(e.RENDERBUFFER,ne,l.width,l.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,ie,e.RENDERBUFFER,x)}else{const G=l.textures;for(let k=0;k<G.length;k++){const ne=G[k],ie=a.convert(ne.format,ne.colorSpace),W=a.convert(ne.type),q=S(ne.internalFormat,ie,W,ne.normalized,ne.colorSpace);lt(l)?s.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,at(l),q,l.width,l.height):y?e.renderbufferStorageMultisample(e.RENDERBUFFER,at(l),q,l.width,l.height):e.renderbufferStorage(e.RENDERBUFFER,q,l.width,l.height)}}e.bindRenderbuffer(e.RENDERBUFFER,null)}function dt(x,l,y){const G=l.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(e.FRAMEBUFFER,x),!(l.depthTexture&&l.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");const k=i.get(l.depthTexture);if(k.__renderTarget=l,(!k.__webglTexture||l.depthTexture.image.width!==l.width||l.depthTexture.image.height!==l.height)&&(l.depthTexture.image.width=l.width,l.depthTexture.image.height=l.height,l.depthTexture.needsUpdate=!0),G){if(k.__webglInit===void 0&&(k.__webglInit=!0,l.depthTexture.addEventListener("dispose",C)),k.__webglTexture===void 0){k.__webglTexture=e.createTexture(),t.bindTexture(e.TEXTURE_CUBE_MAP,k.__webglTexture),Ke(e.TEXTURE_CUBE_MAP,l.depthTexture);const re=a.convert(l.depthTexture.format),Me=a.convert(l.depthTexture.type);let ce;l.depthTexture.format===En?ce=e.DEPTH_COMPONENT24:l.depthTexture.format===pn&&(ce=e.DEPTH24_STENCIL8);for(let ae=0;ae<6;ae++)e.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ae,0,ce,l.width,l.height,0,re,Me,null)}}else te(l.depthTexture,0);const ne=k.__webglTexture,ie=at(l),W=G?e.TEXTURE_CUBE_MAP_POSITIVE_X+y:e.TEXTURE_2D,q=l.depthTexture.format===pn?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;if(l.depthTexture.format===En)lt(l)?s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,q,W,ne,0,ie):e.framebufferTexture2D(e.FRAMEBUFFER,q,W,ne,0);else if(l.depthTexture.format===pn)lt(l)?s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,q,W,ne,0,ie):e.framebufferTexture2D(e.FRAMEBUFFER,q,W,ne,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function Ie(x){const l=i.get(x),y=x.isWebGLCubeRenderTarget===!0;if(l.__boundDepthTexture!==x.depthTexture){const G=x.depthTexture;if(l.__depthDisposeCallback&&l.__depthDisposeCallback(),G){const k=()=>{delete l.__boundDepthTexture,delete l.__depthDisposeCallback,G.removeEventListener("dispose",k)};G.addEventListener("dispose",k),l.__depthDisposeCallback=k}l.__boundDepthTexture=G}if(x.depthTexture&&!l.__autoAllocateDepthBuffer)if(y)for(let G=0;G<6;G++)dt(l.__webglFramebuffer[G],x,G);else{const G=x.texture.mipmaps;G&&G.length>0?dt(l.__webglFramebuffer[0],x,0):dt(l.__webglFramebuffer,x,0)}else if(y){l.__webglDepthbuffer=[];for(let G=0;G<6;G++)if(t.bindFramebuffer(e.FRAMEBUFFER,l.__webglFramebuffer[G]),l.__webglDepthbuffer[G]===void 0)l.__webglDepthbuffer[G]=e.createRenderbuffer(),Be(l.__webglDepthbuffer[G],x,!1);else{const k=x.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,ne=l.__webglDepthbuffer[G];e.bindRenderbuffer(e.RENDERBUFFER,ne),e.framebufferRenderbuffer(e.FRAMEBUFFER,k,e.RENDERBUFFER,ne)}}else{const G=x.texture.mipmaps;if(G&&G.length>0?t.bindFramebuffer(e.FRAMEBUFFER,l.__webglFramebuffer[0]):t.bindFramebuffer(e.FRAMEBUFFER,l.__webglFramebuffer),l.__webglDepthbuffer===void 0)l.__webglDepthbuffer=e.createRenderbuffer(),Be(l.__webglDepthbuffer,x,!1);else{const k=x.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,ne=l.__webglDepthbuffer;e.bindRenderbuffer(e.RENDERBUFFER,ne),e.framebufferRenderbuffer(e.FRAMEBUFFER,k,e.RENDERBUFFER,ne)}}t.bindFramebuffer(e.FRAMEBUFFER,null)}function He(x,l,y){const G=i.get(x);l!==void 0&&_e(G.__webglFramebuffer,x,x.texture,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,0),y!==void 0&&Ie(x)}function $e(x){const l=x.texture,y=i.get(x),G=i.get(l);x.addEventListener("dispose",m);const k=x.textures,ne=x.isWebGLCubeRenderTarget===!0,ie=k.length>1;if(ie||(G.__webglTexture===void 0&&(G.__webglTexture=e.createTexture()),G.__version=l.version,o.memory.textures++),ne){y.__webglFramebuffer=[];for(let W=0;W<6;W++)if(l.mipmaps&&l.mipmaps.length>0){y.__webglFramebuffer[W]=[];for(let q=0;q<l.mipmaps.length;q++)y.__webglFramebuffer[W][q]=e.createFramebuffer()}else y.__webglFramebuffer[W]=e.createFramebuffer()}else{if(l.mipmaps&&l.mipmaps.length>0){y.__webglFramebuffer=[];for(let W=0;W<l.mipmaps.length;W++)y.__webglFramebuffer[W]=e.createFramebuffer()}else y.__webglFramebuffer=e.createFramebuffer();if(ie)for(let W=0,q=k.length;W<q;W++){const re=i.get(k[W]);re.__webglTexture===void 0&&(re.__webglTexture=e.createTexture(),o.memory.textures++)}if(x.samples>0&&lt(x)===!1){y.__webglMultisampledFramebuffer=e.createFramebuffer(),y.__webglColorRenderbuffer=[],t.bindFramebuffer(e.FRAMEBUFFER,y.__webglMultisampledFramebuffer);for(let W=0;W<k.length;W++){const q=k[W];y.__webglColorRenderbuffer[W]=e.createRenderbuffer(),e.bindRenderbuffer(e.RENDERBUFFER,y.__webglColorRenderbuffer[W]);const re=a.convert(q.format,q.colorSpace),Me=a.convert(q.type),ce=S(q.internalFormat,re,Me,q.normalized,q.colorSpace,x.isXRRenderTarget===!0),ae=at(x);e.renderbufferStorageMultisample(e.RENDERBUFFER,ae,ce,x.width,x.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+W,e.RENDERBUFFER,y.__webglColorRenderbuffer[W])}e.bindRenderbuffer(e.RENDERBUFFER,null),x.depthBuffer&&(y.__webglDepthRenderbuffer=e.createRenderbuffer(),Be(y.__webglDepthRenderbuffer,x,!0)),t.bindFramebuffer(e.FRAMEBUFFER,null)}}if(ne){t.bindTexture(e.TEXTURE_CUBE_MAP,G.__webglTexture),Ke(e.TEXTURE_CUBE_MAP,l);for(let W=0;W<6;W++)if(l.mipmaps&&l.mipmaps.length>0)for(let q=0;q<l.mipmaps.length;q++)_e(y.__webglFramebuffer[W][q],x,l,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+W,q);else _e(y.__webglFramebuffer[W],x,l,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+W,0);f(l)&&b(e.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(ie){for(let W=0,q=k.length;W<q;W++){const re=k[W],Me=i.get(re);let ce=e.TEXTURE_2D;(x.isWebGL3DRenderTarget||x.isWebGLArrayRenderTarget)&&(ce=x.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),t.bindTexture(ce,Me.__webglTexture),Ke(ce,re),_e(y.__webglFramebuffer,x,re,e.COLOR_ATTACHMENT0+W,ce,0),f(re)&&b(ce)}t.unbindTexture()}else{let W=e.TEXTURE_2D;if((x.isWebGL3DRenderTarget||x.isWebGLArrayRenderTarget)&&(W=x.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),t.bindTexture(W,G.__webglTexture),Ke(W,l),l.mipmaps&&l.mipmaps.length>0)for(let q=0;q<l.mipmaps.length;q++)_e(y.__webglFramebuffer[q],x,l,e.COLOR_ATTACHMENT0,W,q);else _e(y.__webglFramebuffer,x,l,e.COLOR_ATTACHMENT0,W,0);f(l)&&b(W),t.unbindTexture()}x.depthBuffer&&Ie(x)}function Fe(x){const l=x.textures;for(let y=0,G=l.length;y<G;y++){const k=l[y];if(f(k)){const ne=D(x),ie=i.get(k).__webglTexture;t.bindTexture(ne,ie),b(ne),t.unbindTexture()}}}const rt=[],ht=[];function Mt(x){if(x.samples>0){if(lt(x)===!1){const l=x.textures,y=x.width,G=x.height;let k=e.COLOR_BUFFER_BIT;const ne=x.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,ie=i.get(x),W=l.length>1;if(W)for(let re=0;re<l.length;re++)t.bindFramebuffer(e.FRAMEBUFFER,ie.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+re,e.RENDERBUFFER,null),t.bindFramebuffer(e.FRAMEBUFFER,ie.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+re,e.TEXTURE_2D,null,0);t.bindFramebuffer(e.READ_FRAMEBUFFER,ie.__webglMultisampledFramebuffer);const q=x.texture.mipmaps;q&&q.length>0?t.bindFramebuffer(e.DRAW_FRAMEBUFFER,ie.__webglFramebuffer[0]):t.bindFramebuffer(e.DRAW_FRAMEBUFFER,ie.__webglFramebuffer);for(let re=0;re<l.length;re++){if(x.resolveDepthBuffer&&(x.depthBuffer&&(k|=e.DEPTH_BUFFER_BIT),x.stencilBuffer&&x.resolveStencilBuffer&&(k|=e.STENCIL_BUFFER_BIT)),W){e.framebufferRenderbuffer(e.READ_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.RENDERBUFFER,ie.__webglColorRenderbuffer[re]);const Me=i.get(l[re]).__webglTexture;e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,Me,0)}e.blitFramebuffer(0,0,y,G,0,0,y,G,k,e.NEAREST),c===!0&&(rt.length=0,ht.length=0,rt.push(e.COLOR_ATTACHMENT0+re),x.depthBuffer&&x.storeMultisampledDepthBuffer===!1&&(rt.push(ne),ht.push(ne),e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,ht)),e.invalidateFramebuffer(e.READ_FRAMEBUFFER,rt))}if(t.bindFramebuffer(e.READ_FRAMEBUFFER,null),t.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),W)for(let re=0;re<l.length;re++){t.bindFramebuffer(e.FRAMEBUFFER,ie.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+re,e.RENDERBUFFER,ie.__webglColorRenderbuffer[re]);const Me=i.get(l[re]).__webglTexture;t.bindFramebuffer(e.FRAMEBUFFER,ie.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+re,e.TEXTURE_2D,Me,0)}t.bindFramebuffer(e.DRAW_FRAMEBUFFER,ie.__webglMultisampledFramebuffer)}else if(x.depthBuffer&&x.storeMultisampledDepthBuffer===!1&&c){const l=x.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,[l])}}}function at(x){return Math.min(r.maxSamples,x.samples)}function lt(x){const l=i.get(x);return x.samples>0&&n.has("WEBGL_multisampled_render_to_texture")===!0&&l.__useRenderToTexture!==!1}function L(x){const l=o.render.frame;g.get(x)!==l&&(g.set(x,l),x.update())}function _t(x,l){const y=x.colorSpace,G=x.format,k=x.type;return x.isCompressedTexture===!0||x.isVideoTexture===!0||y!==Dt&&y!==dn&&(it.getTransfer(y)===Je?(G!==kt||k!==Ot)&&Xe("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):nt("WebGLTextures: Unsupported texture color space:",y)),l}function ze(x){return typeof HTMLImageElement<"u"&&x instanceof HTMLImageElement?(d.width=x.naturalWidth||x.width,d.height=x.naturalHeight||x.height):typeof VideoFrame<"u"&&x instanceof VideoFrame?(d.width=x.displayWidth,d.height=x.displayHeight):(d.width=x.width,d.height=x.height),d}this.allocateTextureUnit=Z,this.resetTextureUnits=V,this.getTextureUnits=I,this.setTextureUnits=X,this.setTexture2D=te,this.setTexture2DArray=$,this.setTexture3D=J,this.setTextureCube=ee,this.rebindTextures=He,this.setupRenderTarget=$e,this.updateRenderTargetMipmap=Fe,this.updateMultisampleRenderTarget=Mt,this.setupDepthRenderbuffer=Ie,this.setupFrameBufferTexture=_e,this.useMultisampledRTT=lt,this.isReversedDepthBuffer=function(){return t.buffers.depth.getReversed()}}function zu(e,n){function t(i,r=dn){let a;const o=it.getTransfer(r);if(i===Ot)return e.UNSIGNED_BYTE;if(i===_a)return e.UNSIGNED_SHORT_4_4_4_4;if(i===ga)return e.UNSIGNED_SHORT_5_5_5_1;if(i===is)return e.UNSIGNED_INT_5_9_9_9_REV;if(i===rs)return e.UNSIGNED_INT_10F_11F_11F_REV;if(i===as)return e.BYTE;if(i===os)return e.SHORT;if(i===Zn)return e.UNSIGNED_SHORT;if(i===Ma)return e.INT;if(i===on)return e.UNSIGNED_INT;if(i===jt)return e.FLOAT;if(i===zt)return e.HALF_FLOAT;if(i===ss)return e.ALPHA;if(i===cs)return e.RGB;if(i===kt)return e.RGBA;if(i===En)return e.DEPTH_COMPONENT;if(i===pn)return e.DEPTH_STENCIL;if(i===ls)return e.RED;if(i===ma)return e.RED_INTEGER;if(i===xn)return e.RG;if(i===ha)return e.RG_INTEGER;if(i===pa)return e.RGBA_INTEGER;if(i===ii||i===ri||i===ai||i===oi)if(o===Je)if(a=n.get("WEBGL_compressed_texture_s3tc_srgb"),a!==null){if(i===ii)return a.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===ri)return a.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===ai)return a.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===oi)return a.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(a=n.get("WEBGL_compressed_texture_s3tc"),a!==null){if(i===ii)return a.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===ri)return a.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===ai)return a.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===oi)return a.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===Ji||i===er||i===tr||i===nr)if(a=n.get("WEBGL_compressed_texture_pvrtc"),a!==null){if(i===Ji)return a.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===er)return a.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===tr)return a.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===nr)return a.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===ir||i===rr||i===ar||i===or||i===sr||i===xi||i===cr)if(a=n.get("WEBGL_compressed_texture_etc"),a!==null){if(i===ir||i===rr)return o===Je?a.COMPRESSED_SRGB8_ETC2:a.COMPRESSED_RGB8_ETC2;if(i===ar)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:a.COMPRESSED_RGBA8_ETC2_EAC;if(i===or)return a.COMPRESSED_R11_EAC;if(i===sr)return a.COMPRESSED_SIGNED_R11_EAC;if(i===xi)return a.COMPRESSED_RG11_EAC;if(i===cr)return a.COMPRESSED_SIGNED_RG11_EAC}else return null;if(i===lr||i===fr||i===dr||i===ur||i===pr||i===hr||i===mr||i===_r||i===gr||i===vr||i===Sr||i===xr||i===Er||i===Mr)if(a=n.get("WEBGL_compressed_texture_astc"),a!==null){if(i===lr)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:a.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===fr)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:a.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===dr)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:a.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===ur)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:a.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===pr)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:a.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===hr)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:a.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===mr)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:a.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===_r)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:a.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===gr)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:a.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===vr)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:a.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===Sr)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:a.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===xr)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:a.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===Er)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:a.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===Mr)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:a.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===Tr||i===Ar||i===Rr)if(a=n.get("EXT_texture_compression_bptc"),a!==null){if(i===Tr)return o===Je?a.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:a.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===Ar)return a.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===Rr)return a.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===br||i===Cr||i===Ei||i===wr)if(a=n.get("EXT_texture_compression_rgtc"),a!==null){if(i===br)return a.COMPRESSED_RED_RGTC1_EXT;if(i===Cr)return a.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===Ei)return a.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===wr)return a.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===Fn?e.UNSIGNED_INT_24_8:e[i]!==void 0?e[i]:null}return{convert:t}}const Xu=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Ku=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class qu{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(n,t){if(this.texture===null){const i=new Ea(n.texture);(n.depthNear!==t.depthNear||n.depthFar!==t.depthFar)&&(this.depthNear=n.depthNear,this.depthFar=n.depthFar),this.texture=i}}getMesh(n){if(this.texture!==null&&this.mesh===null){const t=n.cameras[0].viewport,i=new Xt({vertexShader:Xu,fragmentShader:Ku,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new et(new va(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class Yu extends Bo{constructor(n,t){super();const i=this;let r=null,a=1,o=null,s="local-floor",c=1,d=null,g=null,_=null,p=null,v=null,R=null;const E=typeof XRWebGLBinding<"u",u=new qu,f={},b=t.getContextAttributes();let D=null,S=null;const A=[],M=[],C=new mt;let m=null,T=null;const U=new mn;U.viewport=new xt;const N=new mn;N.viewport=new xt;const B=[U,N],V=new Go;let I=null,X=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(z){let j=A[z];return j===void 0&&(j=new ni,A[z]=j),j.getTargetRaySpace()},this.getControllerGrip=function(z){let j=A[z];return j===void 0&&(j=new ni,A[z]=j),j.getGripSpace()},this.getHand=function(z){let j=A[z];return j===void 0&&(j=new ni,A[z]=j),j.getHandSpace()};function Z(z){const j=M.indexOf(z.inputSource);if(j===-1)return;const Ee=A[j];Ee!==void 0&&(Ee.update(z.inputSource,z.frame,d||o),Ee.dispatchEvent({type:z.type,data:z.inputSource}))}function Y(){r.removeEventListener("select",Z),r.removeEventListener("selectstart",Z),r.removeEventListener("selectend",Z),r.removeEventListener("squeeze",Z),r.removeEventListener("squeezestart",Z),r.removeEventListener("squeezeend",Z),r.removeEventListener("end",Y),r.removeEventListener("inputsourceschange",te);for(let z=0;z<A.length;z++){const j=M[z];j!==null&&(M[z]=null,A[z].disconnect(j))}I=null,X=null,u.reset();for(const z in f)delete f[z];if(n.setRenderTarget(D),v=null,p=null,_=null,r=null,S=null,qe.stop(),i.isPresenting=!1,n.setPixelRatio(m),n.setSize(C.width,C.height,!1),T!==null){const z=T.camera;z.fov=T.fov,z.zoom=T.zoom,z.updateProjectionMatrix(),T=null}i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(z){a=z,i.isPresenting===!0&&Xe("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(z){s=z,i.isPresenting===!0&&Xe("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return d||o},this.setReferenceSpace=function(z){d=z},this.getBaseLayer=function(){return p!==null?p:v},this.getBinding=function(){return _===null&&E&&(_=new XRWebGLBinding(r,t)),_},this.getFrame=function(){return R},this.getSession=function(){return r},this.setSession=async function(z){if(r=z,r!==null){if(D=n.getRenderTarget(),r.addEventListener("select",Z),r.addEventListener("selectstart",Z),r.addEventListener("selectend",Z),r.addEventListener("squeeze",Z),r.addEventListener("squeezestart",Z),r.addEventListener("squeezeend",Z),r.addEventListener("end",Y),r.addEventListener("inputsourceschange",te),b.xrCompatible!==!0&&await t.makeXRCompatible(),m=n.getPixelRatio(),n.getSize(C),E&&"createProjectionLayer"in XRWebGLBinding.prototype){let Ee=null,Ue=null,_e=null;b.depth&&(_e=b.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,Ee=b.stencil?pn:En,Ue=b.stencil?Fn:on);const Be={colorFormat:t.RGBA8,depthFormat:_e,scaleFactor:a};_=this.getBinding(),p=_.createProjectionLayer(Be),r.updateRenderState({layers:[p]}),n.setPixelRatio(1),n.setSize(p.textureWidth,p.textureHeight,!1),S=new Lt(p.textureWidth,p.textureHeight,{format:kt,type:Ot,depthTexture:new Yn(p.textureWidth,p.textureHeight,Ue,void 0,void 0,void 0,void 0,void 0,void 0,Ee),stencilBuffer:b.stencil,colorSpace:n.outputColorSpace,samples:b.antialias?4:0,resolveDepthBuffer:p.ignoreDepthValues===!1,resolveStencilBuffer:p.ignoreDepthValues===!1,storeMultisampledDepthBuffer:p.ignoreDepthValues===!1,storeMultisampledStencilBuffer:p.ignoreDepthValues===!1})}else{const Ee={antialias:b.antialias,alpha:!0,depth:b.depth,stencil:b.stencil,framebufferScaleFactor:a};v=new XRWebGLLayer(r,t,Ee),r.updateRenderState({baseLayer:v}),n.setPixelRatio(1),n.setSize(v.framebufferWidth,v.framebufferHeight,!1),S=new Lt(v.framebufferWidth,v.framebufferHeight,{format:kt,type:Ot,colorSpace:n.outputColorSpace,stencilBuffer:b.stencil,resolveDepthBuffer:v.ignoreDepthValues===!1,resolveStencilBuffer:v.ignoreDepthValues===!1,storeMultisampledDepthBuffer:v.ignoreDepthValues===!1,storeMultisampledStencilBuffer:v.ignoreDepthValues===!1})}S.isXRRenderTarget=!0,this.setFoveation(c),d=null,o=await r.requestReferenceSpace(s),qe.setContext(r),qe.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode},this.getDepthTexture=function(){return u.getDepthTexture()};function te(z){for(let j=0;j<z.removed.length;j++){const Ee=z.removed[j],Ue=M.indexOf(Ee);Ue>=0&&(M[Ue]=null,A[Ue].disconnect(Ee))}for(let j=0;j<z.added.length;j++){const Ee=z.added[j];let Ue=M.indexOf(Ee);if(Ue===-1){for(let Be=0;Be<A.length;Be++)if(Be>=M.length){M.push(Ee),Ue=Be;break}else if(M[Be]===null){M[Be]=Ee,Ue=Be;break}if(Ue===-1)break}const _e=A[Ue];_e&&_e.connect(Ee)}}const $=new me,J=new me;function ee(z,j,Ee){$.setFromMatrixPosition(j.matrixWorld),J.setFromMatrixPosition(Ee.matrixWorld);const Ue=$.distanceTo(J),_e=j.projectionMatrix.elements,Be=Ee.projectionMatrix.elements,dt=_e[14]/(_e[10]-1),Ie=_e[14]/(_e[10]+1),He=(_e[9]+1)/_e[5],$e=(_e[9]-1)/_e[5],Fe=(_e[8]-1)/_e[0],rt=(Be[8]+1)/Be[0],ht=dt*Fe,Mt=dt*rt,at=Ue/(-Fe+rt),lt=at*-Fe;if(j.matrixWorld.decompose(z.position,z.quaternion,z.scale),z.translateX(lt),z.translateZ(at),z.matrixWorld.compose(z.position,z.quaternion,z.scale),z.matrixWorldInverse.copy(z.matrixWorld).invert(),_e[10]===-1)z.projectionMatrix.copy(j.projectionMatrix),z.projectionMatrixInverse.copy(j.projectionMatrixInverse);else{const L=dt+at,_t=Ie+at,ze=ht-lt,x=Mt+(Ue-lt),l=He*Ie/_t*L,y=$e*Ie/_t*L;z.projectionMatrix.makePerspective(ze,x,l,y,L,_t),z.projectionMatrixInverse.copy(z.projectionMatrix).invert()}}function we(z,j){j===null?z.matrixWorld.copy(z.matrix):z.matrixWorld.multiplyMatrices(j.matrixWorld,z.matrix),z.matrixWorldInverse.copy(z.matrixWorld).invert()}this.updateCamera=function(z){if(r===null)return;let j=z.near,Ee=z.far;u.texture!==null&&(u.depthNear>0&&(j=u.depthNear),u.depthFar>0&&(Ee=u.depthFar)),V.near=N.near=U.near=j,V.far=N.far=U.far=Ee,(I!==V.near||X!==V.far)&&(r.updateRenderState({depthNear:V.near,depthFar:V.far}),I=V.near,X=V.far),V.layers.mask=z.layers.mask|6,U.layers.mask=V.layers.mask&-5,N.layers.mask=V.layers.mask&-3;const Ue=z.parent,_e=V.cameras;we(V,Ue);for(let Be=0;Be<_e.length;Be++)we(_e[Be],Ue);_e.length===2?ee(V,U,N):V.projectionMatrix.copy(U.projectionMatrix),T===null&&z.isPerspectiveCamera&&(T={camera:z,fov:z.fov,zoom:z.zoom}),Ce(z,V,Ue)};function Ce(z,j,Ee){Ee===null?z.matrix.copy(j.matrixWorld):(z.matrix.copy(Ee.matrixWorld),z.matrix.invert(),z.matrix.multiply(j.matrixWorld)),z.matrix.decompose(z.position,z.quaternion,z.scale),z.updateMatrixWorld(!0),z.projectionMatrix.copy(j.projectionMatrix),z.projectionMatrixInverse.copy(j.projectionMatrixInverse),z.isPerspectiveCamera&&(z.fov=Ho*2*Math.atan(1/z.projectionMatrix.elements[5]),z.zoom=1)}this.getCamera=function(){return V},this.getFoveation=function(){if(!(p===null&&v===null))return c},this.setFoveation=function(z){c=z,p!==null&&(p.fixedFoveation=z),v!==null&&v.fixedFoveation!==void 0&&(v.fixedFoveation=z)},this.hasDepthSensing=function(){return u.texture!==null},this.getDepthSensingMesh=function(){return u.getMesh(V)},this.getCameraTexture=function(z){return f[z]};let ot=null;function Ke(z,j){if(g=j.getViewerPose(d||o),R=j,g!==null){const Ee=g.views;v!==null&&(n.setRenderTargetFramebuffer(S,v.framebuffer),n.setRenderTarget(S));let Ue=!1;Ee.length!==V.cameras.length&&(V.cameras.length=0,Ue=!0);for(let Ie=0;Ie<Ee.length;Ie++){const He=Ee[Ie];let $e=null;if(v!==null)$e=v.getViewport(He);else{const rt=_.getViewSubImage(p,He);$e=rt.viewport,Ie===0&&(n.setRenderTargetTextures(S,rt.colorTexture,rt.depthStencilTexture),n.setRenderTarget(S))}let Fe=B[Ie];Fe===void 0&&(Fe=new mn,Fe.layers.enable(Ie),Fe.viewport=new xt,B[Ie]=Fe),Fe.matrix.fromArray(He.transform.matrix),Fe.matrix.decompose(Fe.position,Fe.quaternion,Fe.scale),Fe.projectionMatrix.fromArray(He.projectionMatrix),Fe.projectionMatrixInverse.copy(Fe.projectionMatrix).invert(),Fe.viewport.set($e.x,$e.y,$e.width,$e.height),Ie===0&&(V.matrix.copy(Fe.matrix),V.matrix.decompose(V.position,V.quaternion,V.scale)),Ue===!0&&V.cameras.push(Fe)}const _e=r.enabledFeatures;if(_e&&_e.includes("depth-sensing")&&r.depthUsage=="gpu-optimized"&&E){_=i.getBinding();const Ie=_.getDepthInformation(Ee[0]);Ie&&Ie.isValid&&Ie.texture&&u.init(Ie,r.renderState)}if(_e&&_e.includes("camera-access")&&E){n.state.unbindTexture(),_=i.getBinding();for(let Ie=0;Ie<Ee.length;Ie++){const He=Ee[Ie].camera;if(He){let $e=f[He];$e||($e=new Ea,f[He]=$e);const Fe=_.getCameraImage(He);$e.sourceTexture=Fe}}}}for(let Ee=0;Ee<A.length;Ee++){const Ue=M[Ee],_e=A[Ee];Ue!==null&&_e!==void 0&&_e.update(Ue,j,d||o)}ot&&ot(z,j),j.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:j}),R=null}const qe=new Ha;qe.setAnimationLoop(Ke),this.setAnimationLoop=function(z){ot=z},this.dispose=function(){}}}const Zu=new Et,qa=new Oe;qa.set(-1,0,0,0,1,0,0,0,1);function $u(e,n){function t(u,f){u.matrixAutoUpdate===!0&&u.updateMatrix(),f.value.copy(u.matrix)}function i(u,f){f.color.getRGB(u.fogColor.value,Sa(e)),f.isFog?(u.fogNear.value=f.near,u.fogFar.value=f.far):f.isFogExp2&&(u.fogDensity.value=f.density)}function r(u,f,b,D,S){f.isNodeMaterial?f.uniformsNeedUpdate=!1:f.isMeshBasicMaterial?a(u,f):f.isMeshLambertMaterial?(a(u,f),f.envMap&&(u.envMapIntensity.value=f.envMapIntensity)):f.isMeshToonMaterial?(a(u,f),_(u,f)):f.isMeshPhongMaterial?(a(u,f),g(u,f),f.envMap&&(u.envMapIntensity.value=f.envMapIntensity)):f.isMeshStandardMaterial?(a(u,f),p(u,f),f.isMeshPhysicalMaterial&&v(u,f,S)):f.isMeshMatcapMaterial?(a(u,f),R(u,f)):f.isMeshDepthMaterial?a(u,f):f.isMeshDistanceMaterial?(a(u,f),E(u,f)):f.isMeshNormalMaterial?a(u,f):f.isLineBasicMaterial?(o(u,f),f.isLineDashedMaterial&&s(u,f)):f.isPointsMaterial?c(u,f,b,D):f.isSpriteMaterial?d(u,f):f.isShadowMaterial?(u.color.value.copy(f.color),u.opacity.value=f.opacity):f.isShaderMaterial&&(f.uniformsNeedUpdate=!1)}function a(u,f){u.opacity.value=f.opacity,f.color&&u.diffuse.value.copy(f.color),f.emissive&&u.emissive.value.copy(f.emissive).multiplyScalar(f.emissiveIntensity),f.map&&(u.map.value=f.map,t(f.map,u.mapTransform)),f.alphaMap&&(u.alphaMap.value=f.alphaMap,t(f.alphaMap,u.alphaMapTransform)),f.bumpMap&&(u.bumpMap.value=f.bumpMap,t(f.bumpMap,u.bumpMapTransform),u.bumpScale.value=f.bumpScale,f.side===At&&(u.bumpScale.value*=-1)),f.normalMap&&(u.normalMap.value=f.normalMap,t(f.normalMap,u.normalMapTransform),u.normalScale.value.copy(f.normalScale),f.side===At&&u.normalScale.value.negate()),f.displacementMap&&(u.displacementMap.value=f.displacementMap,t(f.displacementMap,u.displacementMapTransform),u.displacementScale.value=f.displacementScale,u.displacementBias.value=f.displacementBias),f.emissiveMap&&(u.emissiveMap.value=f.emissiveMap,t(f.emissiveMap,u.emissiveMapTransform)),f.specularMap&&(u.specularMap.value=f.specularMap,t(f.specularMap,u.specularMapTransform)),f.alphaTest>0&&(u.alphaTest.value=f.alphaTest);const b=n.get(f),D=b.envMap,S=b.envMapRotation;D&&(u.envMap.value=D,u.envMapRotation.value.setFromMatrix4(Zu.makeRotationFromEuler(S)).transpose(),D.isCubeTexture&&D.isRenderTargetTexture===!1&&u.envMapRotation.value.premultiply(qa),u.reflectivity.value=f.reflectivity,u.ior.value=f.ior,u.refractionRatio.value=f.refractionRatio),f.lightMap&&(u.lightMap.value=f.lightMap,u.lightMapIntensity.value=f.lightMapIntensity,t(f.lightMap,u.lightMapTransform)),f.aoMap&&(u.aoMap.value=f.aoMap,u.aoMapIntensity.value=f.aoMapIntensity,t(f.aoMap,u.aoMapTransform))}function o(u,f){u.diffuse.value.copy(f.color),u.opacity.value=f.opacity,f.map&&(u.map.value=f.map,t(f.map,u.mapTransform))}function s(u,f){u.dashSize.value=f.dashSize,u.totalSize.value=f.dashSize+f.gapSize,u.scale.value=f.scale}function c(u,f,b,D){u.diffuse.value.copy(f.color),u.opacity.value=f.opacity,u.size.value=f.size*b,u.scale.value=D*.5,f.map&&(u.map.value=f.map,t(f.map,u.uvTransform)),f.alphaMap&&(u.alphaMap.value=f.alphaMap,t(f.alphaMap,u.alphaMapTransform)),f.alphaTest>0&&(u.alphaTest.value=f.alphaTest)}function d(u,f){u.diffuse.value.copy(f.color),u.opacity.value=f.opacity,u.rotation.value=f.rotation,f.map&&(u.map.value=f.map,t(f.map,u.mapTransform)),f.alphaMap&&(u.alphaMap.value=f.alphaMap,t(f.alphaMap,u.alphaMapTransform)),f.alphaTest>0&&(u.alphaTest.value=f.alphaTest)}function g(u,f){u.specular.value.copy(f.specular),u.shininess.value=Math.max(f.shininess,1e-4)}function _(u,f){f.gradientMap&&(u.gradientMap.value=f.gradientMap)}function p(u,f){u.metalness.value=f.metalness,f.metalnessMap&&(u.metalnessMap.value=f.metalnessMap,t(f.metalnessMap,u.metalnessMapTransform)),u.roughness.value=f.roughness,f.roughnessMap&&(u.roughnessMap.value=f.roughnessMap,t(f.roughnessMap,u.roughnessMapTransform)),f.envMap&&(u.envMapIntensity.value=f.envMapIntensity)}function v(u,f,b){u.ior.value=f.ior,f.sheen>0&&(u.sheenColor.value.copy(f.sheenColor).multiplyScalar(f.sheen),u.sheenRoughness.value=f.sheenRoughness,f.sheenColorMap&&(u.sheenColorMap.value=f.sheenColorMap,t(f.sheenColorMap,u.sheenColorMapTransform)),f.sheenRoughnessMap&&(u.sheenRoughnessMap.value=f.sheenRoughnessMap,t(f.sheenRoughnessMap,u.sheenRoughnessMapTransform))),f.clearcoat>0&&(u.clearcoat.value=f.clearcoat,u.clearcoatRoughness.value=f.clearcoatRoughness,f.clearcoatMap&&(u.clearcoatMap.value=f.clearcoatMap,t(f.clearcoatMap,u.clearcoatMapTransform)),f.clearcoatRoughnessMap&&(u.clearcoatRoughnessMap.value=f.clearcoatRoughnessMap,t(f.clearcoatRoughnessMap,u.clearcoatRoughnessMapTransform)),f.clearcoatNormalMap&&(u.clearcoatNormalMap.value=f.clearcoatNormalMap,t(f.clearcoatNormalMap,u.clearcoatNormalMapTransform),u.clearcoatNormalScale.value.copy(f.clearcoatNormalScale),f.side===At&&u.clearcoatNormalScale.value.negate())),f.dispersion>0&&(u.dispersion.value=f.dispersion),f.retroreflectivity>0&&(u.retroreflectivity.value=f.retroreflectivity),f.iridescence>0&&(u.iridescence.value=f.iridescence,u.iridescenceIOR.value=f.iridescenceIOR,u.iridescenceThicknessMinimum.value=f.iridescenceThicknessRange[0],u.iridescenceThicknessMaximum.value=f.iridescenceThicknessRange[1],f.iridescenceMap&&(u.iridescenceMap.value=f.iridescenceMap,t(f.iridescenceMap,u.iridescenceMapTransform)),f.iridescenceThicknessMap&&(u.iridescenceThicknessMap.value=f.iridescenceThicknessMap,t(f.iridescenceThicknessMap,u.iridescenceThicknessMapTransform))),f.transmission>0&&(u.transmission.value=f.transmission,u.transmissionSamplerMap.value=b.texture,u.transmissionSamplerSize.value.set(b.width,b.height),f.transmissionMap&&(u.transmissionMap.value=f.transmissionMap,t(f.transmissionMap,u.transmissionMapTransform)),u.thickness.value=f.thickness,f.thicknessMap&&(u.thicknessMap.value=f.thicknessMap,t(f.thicknessMap,u.thicknessMapTransform)),u.attenuationDistance.value=f.attenuationDistance,u.attenuationColor.value.copy(f.attenuationColor)),f.anisotropy>0&&(u.anisotropyVector.value.set(f.anisotropy*Math.cos(f.anisotropyRotation),f.anisotropy*Math.sin(f.anisotropyRotation)),f.anisotropyMap&&(u.anisotropyMap.value=f.anisotropyMap,t(f.anisotropyMap,u.anisotropyMapTransform))),u.specularIntensity.value=f.specularIntensity,u.specularColor.value.copy(f.specularColor),f.specularColorMap&&(u.specularColorMap.value=f.specularColorMap,t(f.specularColorMap,u.specularColorMapTransform)),f.specularIntensityMap&&(u.specularIntensityMap.value=f.specularIntensityMap,t(f.specularIntensityMap,u.specularIntensityMapTransform))}function R(u,f){f.matcap&&(u.matcap.value=f.matcap)}function E(u,f){const b=n.get(f).light;u.referencePosition.value.setFromMatrixPosition(b.matrixWorld),u.nearDistance.value=b.shadow.camera.near,u.farDistance.value=b.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:r}}function ju(e,n,t,i){let r={},a={},o=[];const s=e.getParameter(e.MAX_UNIFORM_BUFFER_BINDINGS);function c(S,A){const M=A.program;i.uniformBlockBinding(S,M)}function d(S,A){let M=r[S.id];M===void 0&&(u(S),M=g(S),r[S.id]=M,S.addEventListener("dispose",b));const C=A.program;i.updateUBOMapping(S,C);const m=n.render.frame;a[S.id]!==m&&(p(S),a[S.id]=m)}function g(S){const A=_();S.__bindingPointIndex=A;const M=e.createBuffer(),C=S.__size,m=S.usage;return e.bindBuffer(e.UNIFORM_BUFFER,M),e.bufferData(e.UNIFORM_BUFFER,C,m),e.bindBuffer(e.UNIFORM_BUFFER,null),e.bindBufferBase(e.UNIFORM_BUFFER,A,M),M}function _(){for(let S=0;S<s;S++)if(o.indexOf(S)===-1)return o.push(S),S;return nt("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function p(S){const A=r[S.id],M=S.uniforms,C=S.__cache;e.bindBuffer(e.UNIFORM_BUFFER,A);for(let m=0,T=M.length;m<T;m++){const U=M[m];if(Array.isArray(U))for(let N=0,B=U.length;N<B;N++)v(U[N],m,N,C);else v(U,m,0,C)}e.bindBuffer(e.UNIFORM_BUFFER,null)}function v(S,A,M,C){if(E(S,A,M,C)===!0){const m=S.__offset,T=S.value;if(Array.isArray(T)){let U=0;for(let N=0;N<T.length;N++){const B=T[N],V=f(B);R(B,S.__data,U),typeof B!="number"&&typeof B!="boolean"&&!B.isMatrix3&&!ArrayBuffer.isView(B)&&(U+=V.storage/Float32Array.BYTES_PER_ELEMENT)}}else R(T,S.__data,0);e.bufferSubData(e.UNIFORM_BUFFER,m,S.__data)}}function R(S,A,M){typeof S=="number"||typeof S=="boolean"?A[0]=S:S.isMatrix3?(A[0]=S.elements[0],A[1]=S.elements[1],A[2]=S.elements[2],A[3]=0,A[4]=S.elements[3],A[5]=S.elements[4],A[6]=S.elements[5],A[7]=0,A[8]=S.elements[6],A[9]=S.elements[7],A[10]=S.elements[8],A[11]=0):ArrayBuffer.isView(S)?A.set(new S.constructor(S.buffer,S.byteOffset,A.length)):S.toArray(A,M)}function E(S,A,M,C){const m=S.value,T=A+"_"+M;if(C[T]===void 0)return typeof m=="number"||typeof m=="boolean"?C[T]=m:ArrayBuffer.isView(m)?C[T]=m.slice():C[T]=m.clone(),!0;{const U=C[T];if(typeof m=="number"||typeof m=="boolean"){if(U!==m)return C[T]=m,!0}else{if(ArrayBuffer.isView(m))return!0;if(U.equals(m)===!1)return U.copy(m),!0}}return!1}function u(S){const A=S.uniforms;let M=0;const C=16;for(let T=0,U=A.length;T<U;T++){const N=Array.isArray(A[T])?A[T]:[A[T]];for(let B=0,V=N.length;B<V;B++){const I=N[B],X=Array.isArray(I.value)?I.value:[I.value];for(let Z=0,Y=X.length;Z<Y;Z++){const te=X[Z],$=f(te),J=M%C,ee=J%$.boundary,we=J+ee;M+=ee,we!==0&&C-we<$.storage&&(M+=C-we),I.__data=new Float32Array($.storage/Float32Array.BYTES_PER_ELEMENT),I.__offset=M,M+=$.storage}}}const m=M%C;return m>0&&(M+=C-m),S.__size=M,S.__cache={},this}function f(S){const A={boundary:0,storage:0};return typeof S=="number"||typeof S=="boolean"?(A.boundary=4,A.storage=4):S.isVector2?(A.boundary=8,A.storage=8):S.isVector3||S.isColor?(A.boundary=16,A.storage=12):S.isVector4?(A.boundary=16,A.storage=16):S.isMatrix3?(A.boundary=48,A.storage=48):S.isMatrix4?(A.boundary=64,A.storage=64):S.isTexture?Xe("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(S)?(A.boundary=16,A.storage=S.byteLength):Xe("WebGLRenderer: Unsupported uniform value type.",S),A}function b(S){const A=S.target;A.removeEventListener("dispose",b);const M=o.indexOf(A.__bindingPointIndex);o.splice(M,1),e.deleteBuffer(r[A.id]),delete r[A.id],delete a[A.id]}function D(){for(const S in r)e.deleteBuffer(r[S]);o=[],r={},a={}}return{bind:c,update:d,dispose:D}}const Qu=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]);let It=null;function Ju(){return It===null&&(It=new Vo(Qu,16,16,xn,zt),It.name="DFG_LUT",It.minFilter=vt,It.magFilter=vt,It.wrapS=Kn,It.wrapT=Kn,It.generateMipmaps=!1,It.needsUpdate=!0),It}class ep{constructor(n={}){const{canvas:t=oo(),context:i=null,depth:r=!0,stencil:a=!1,alpha:o=!1,antialias:s=!1,premultipliedAlpha:c=!0,preserveDrawingBuffer:d=!1,powerPreference:g="default",failIfMajorPerformanceCaveat:_=!1,reversedDepthBuffer:p=!1,outputBufferType:v=Ot}=n;this.isWebGLRenderer=!0;let R;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");R=i.getContextAttributes().alpha}else R=o;const E=v,u=new Set([pa,ha,ma]),f=new Set([Ot,on,Zn,Fn,_a,ga]),b=new Uint32Array(4),D=new Int32Array(4),S=new me;let A=null,M=null;const C=[],m=[];let T=null;this.domElement=t,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=Gt,this.toneMappingExposure=1,this.transmissionResolutionScale=1;const U=this;let N=!1,B=null,V=null,I=null,X=null;this._outputColorSpace=Pt;let Z=0,Y=0,te=null,$=-1,J=null;const ee=new xt,we=new xt;let Ce=null;const ot=new Ve(0);let Ke=0,qe=t.width,z=t.height,j=1,Ee=null,Ue=null;const _e=new xt(0,0,qe,z),Be=new xt(0,0,qe,z);let dt=!1;const Ie=new fa;let He=!1,$e=!1;const Fe=new Et,rt=new me,ht=new xt,Mt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let at=!1;function lt(){return te===null?j:1}let L=i;function _t(h,w){return t.getContext(h,w)}let ze,x,l,y,G,k,ne,ie,W,q,re,Me,ce,ae,Te,be,Pe,P,oe,K,se,ue,Q;try{const h={alpha:!0,depth:r,stencil:a,antialias:s,premultipliedAlpha:c,preserveDrawingBuffer:d,powerPreference:g,failIfMajorPerformanceCaveat:_};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${so}`),t.addEventListener("webglcontextlost",je,!1),t.addEventListener("webglcontextrestored",ke,!1),t.addEventListener("webglcontextcreationerror",wt,!1),L===null){const w="webgl2";if(L=_t(w,h),L===null)throw _t(w)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}Ae()}catch(h){throw t.removeEventListener("webglcontextlost",je,!1),t.removeEventListener("webglcontextrestored",ke,!1),t.removeEventListener("webglcontextcreationerror",wt,!1),nt("WebGLRenderer: "+h.message),h}function Ae(){ze=new Jf(L),ze.init(),se=new zu(L,ze),x=new Wf(L,ze,n,se),l=new ku(L,ze),x.reversedDepthBuffer&&p&&l.buffers.depth.setReversed(!0),V=L.createFramebuffer(),I=L.createFramebuffer(),X=L.createFramebuffer(),y=new nd(L),G=new wu,k=new Wu(L,ze,l,G,x,se,y),ne=new Qf(U),ie=new ic(L),ue=new Vf(L,ie),W=new ed(L,ie,y,ue),q=new rd(L,W,ie,ue,y),P=new id(L,x,k),Te=new zf(G),re=new Cu(U,ne,ze,x,ue,Te),Me=new $u(U,G),ce=new Lu,ae=new Fu(ze),Pe=new Hf(U,ne,l,q,R,c),be=new Vu(U,q,x),Q=new ju(L,y,x,l),oe=new kf(L,ze,y),K=new td(L,ze,y),y.programs=re.programs,U.capabilities=x,U.extensions=ze,U.properties=G,U.renderLists=ce,U.shadowMap=be,U.state=l,U.info=y}E!==Ot&&(T=new od(E,t.width,t.height,s,r,a));const Se=new Yu(U,L);this.xr=Se,this.getContext=function(){return L},this.getContextAttributes=function(){return L.getContextAttributes()},this.forceContextLoss=function(){const h=ze.get("WEBGL_lose_context");h&&h.loseContext()},this.forceContextRestore=function(){const h=ze.get("WEBGL_lose_context");h&&h.restoreContext()},this.getPixelRatio=function(){return j},this.setPixelRatio=function(h){h!==void 0&&(j=h,this.setSize(qe,z,!1))},this.getSize=function(h){return h.set(qe,z)},this.setSize=function(h,w,H=!0){if(Se.isPresenting){Xe("WebGLRenderer: Can't change size while VR device is presenting.");return}qe=h,z=w,t.width=Math.floor(h*j),t.height=Math.floor(w*j),H===!0&&(t.style.width=h+"px",t.style.height=w+"px"),T!==null&&T.setSize(t.width,t.height),this.setViewport(0,0,h,w)},this.getDrawingBufferSize=function(h){return h.set(qe*j,z*j).floor()},this.setDrawingBufferSize=function(h,w,H){qe=h,z=w,j=H,t.width=Math.floor(h*H),t.height=Math.floor(w*H),this.setViewport(0,0,h,w)},this.setEffects=function(h){if(E===Ot){nt("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(h){for(let w=0;w<h.length;w++)if(h[w].isOutputPass===!0){Xe("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}T.setEffects(h||[])},this.getCurrentViewport=function(h){return h.copy(ee)},this.getViewport=function(h){return h.copy(_e)},this.setViewport=function(h,w,H,F){h.isVector4?_e.set(h.x,h.y,h.z,h.w):_e.set(h,w,H,F),l.viewport(ee.copy(_e).multiplyScalar(j).round())},this.getScissor=function(h){return h.copy(Be)},this.setScissor=function(h,w,H,F){h.isVector4?Be.set(h.x,h.y,h.z,h.w):Be.set(h,w,H,F),l.scissor(we.copy(Be).multiplyScalar(j).round())},this.getScissorTest=function(){return dt},this.setScissorTest=function(h){l.setScissorTest(dt=h)},this.setOpaqueSort=function(h){Ee=h},this.setTransparentSort=function(h){Ue=h},this.getClearColor=function(h){return h.copy(Pe.getClearColor())},this.setClearColor=function(){Pe.setClearColor(...arguments)},this.getClearAlpha=function(){return Pe.getClearAlpha()},this.setClearAlpha=function(){Pe.setClearAlpha(...arguments)},this.clear=function(h=!0,w=!0,H=!0){let F=0;if(h){let O=!1;if(te!==null){const de=te.texture.format;O=u.has(de)}if(O){const de=te.texture.type,he=f.has(de),fe=Pe.getClearColor(),ge=Pe.getClearAlpha(),xe=fe.r,De=fe.g,Ne=fe.b;he?(b[0]=xe,b[1]=De,b[2]=Ne,b[3]=ge,L.clearBufferuiv(L.COLOR,0,b)):(D[0]=xe,D[1]=De,D[2]=Ne,D[3]=ge,L.clearBufferiv(L.COLOR,0,D))}else F|=L.COLOR_BUFFER_BIT}w&&(F|=L.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),H&&(F|=L.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),F!==0&&L.clear(F)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(h){h.setRenderer(this),B=h},this.dispose=function(){t.removeEventListener("webglcontextlost",je,!1),t.removeEventListener("webglcontextrestored",ke,!1),t.removeEventListener("webglcontextcreationerror",wt,!1),Pe.dispose(),ce.dispose(),ae.dispose(),G.dispose(),ne.dispose(),q.dispose(),ue.dispose(),Q.dispose(),re.dispose(),Se.dispose(),Se.removeEventListener("sessionstart",Ni),Se.removeEventListener("sessionend",Fi),Qt.stop()};function je(h){h.preventDefault(),zi("WebGLRenderer: Context Lost."),N=!0}function ke(){zi("WebGLRenderer: Context Restored."),N=!1;const h=y.autoReset,w=be.enabled,H=be.autoUpdate,F=be.needsUpdate,O=be.type;Ae(),y.autoReset=h,be.enabled=w,be.autoUpdate=H,be.needsUpdate=F,be.type=O}function wt(h){nt("WebGLRenderer: A WebGL context could not be created. Reason: ",h.statusMessage)}function Ut(h){const w=h.target;w.removeEventListener("dispose",Ut),ja(w)}function ja(h){Qa(h),G.remove(h)}function Qa(h){const w=G.get(h).programs;w!==void 0&&(w.forEach(function(H){re.releaseProgram(H)}),h.isShaderMaterial&&re.releaseShaderCache(h))}this.renderBufferDirect=function(h,w,H,F,O,de){w===null&&(w=Mt);const he=O.isMesh&&O.matrixWorld.determinantAffine()<0,fe=to(h,w,H,F,O);l.setMaterial(F,he);let ge=H.index,xe=1;if(F.wireframe===!0){if(ge=W.getWireframeAttribute(H),ge===void 0)return;xe=2}const De=H.drawRange,Ne=H.attributes.position;let ve=De.start*xe,We=(De.start+De.count)*xe;de!==null&&(ve=Math.max(ve,de.start*xe),We=Math.min(We,(de.start+de.count)*xe)),ge!==null?(ve=Math.max(ve,0),We=Math.min(We,ge.count)):Ne!=null&&(ve=Math.max(ve,0),We=Math.min(We,Ne.count));const ft=We-ve;if(ft<0||ft===1/0)return;ue.setup(O,F,fe,H,ge);let tt,Ze=oe;if(ge!==null&&(tt=ie.get(ge),Ze=K,Ze.setIndex(tt)),O.isMesh)F.wireframe===!0?(l.setLineWidth(F.wireframeLinewidth*lt()),Ze.setMode(L.LINES)):Ze.setMode(L.TRIANGLES);else if(O.isLine){let gt=F.linewidth;gt===void 0&&(gt=1),l.setLineWidth(gt*lt()),O.isLineSegments?Ze.setMode(L.LINES):O.isLineLoop?Ze.setMode(L.LINE_LOOP):Ze.setMode(L.LINE_STRIP)}else O.isPoints?Ze.setMode(L.POINTS):O.isSprite&&Ze.setMode(L.TRIANGLES);if(O.isBatchedMesh)if(ze.get("WEBGL_multi_draw"))Ze.renderMultiDraw(O._multiDrawStarts,O._multiDrawCounts,O._multiDrawCount);else{const gt=O._multiDrawStarts,pe=O._multiDrawCounts,St=O._multiDrawCount,Ge=ge?ie.get(ge).bytesPerElement:1,bt=G.get(F).currentProgram.getUniforms();for(let yt=0;yt<St;yt++)bt.setValue(L,"_gl_DrawID",yt),Ze.render(gt[yt]/Ge,pe[yt])}else if(O.isInstancedMesh)Ze.renderInstances(ve,ft,O.count);else if(H.isInstancedBufferGeometry){const gt=H._maxInstanceCount!==void 0?H._maxInstanceCount:1/0,pe=Math.min(H.instanceCount,gt);Ze.renderInstances(ve,ft,pe)}else Ze.render(ve,ft)};function Ii(h,w,H,F){B!==null&&h.isNodeMaterial&&B.setObject(F,h),He===!0&&Te.setState(h,H,!1),h.transparent===!0&&h.side===Bt&&h.forceSinglePass===!1?(h.side=At,h.needsUpdate=!0,Bn(h,w,F),h.side=vn,h.needsUpdate=!0,Bn(h,w,F),h.side=Bt):Bn(h,w,F)}this.compile=function(h,w,H=null){H===null&&(H=h),B!==null&&B.renderStart(h,w,H),M=ae.get(H),M.init(w),m.push(M),H.traverseVisible(function(O){O.isLight&&O.layers.test(w.layers)&&(M.pushLight(O),O.castShadow&&M.pushShadow(O))}),h!==H&&h.traverseVisible(function(O){O.isLight&&O.layers.test(w.layers)&&(M.pushLight(O),O.castShadow&&M.pushShadow(O))}),M.setupLights(),B!==null&&B.updateLights(M.state.lightsArray),$e=this.localClippingEnabled,He=Te.init(this.clippingPlanes,$e),He===!0&&Te.setGlobalState(this.clippingPlanes,w),B!==null&&be.render(M.state.shadowsArray,H,w);const F=new Set;return h.traverse(function(O){if(!(O.isMesh||O.isPoints||O.isLine||O.isSprite))return;const de=O.material;if(de)if(Array.isArray(de))for(let he=0;he<de.length;he++){const fe=de[he];Ii(fe,H,w,O),F.add(fe)}else Ii(de,H,w,O),F.add(de)}),M=m.pop(),B!==null&&B.renderEnd(),F},this.compileAsync=function(h,w,H=null){const F=this.compile(h,w,H);return new Promise(O=>{function de(){if(F.forEach(function(he){const ge=G.get(he).currentProgram;(ge===void 0||ge.isReady())&&F.delete(he)}),F.size===0){O(h);return}setTimeout(de,10)}ze.get("KHR_parallel_shader_compile")!==null?de():setTimeout(de,10)})};let ei=null;function Ja(h){ei&&ei(h)}function Ni(){Qt.stop()}function Fi(){Qt.start()}const Qt=new Ha;Qt.setAnimationLoop(Ja),typeof self<"u"&&Qt.setContext(self),this.setAnimationLoop=function(h){ei=h,Se.setAnimationLoop(h),h===null?Qt.stop():Qt.start()},Se.addEventListener("sessionstart",Ni),Se.addEventListener("sessionend",Fi),this.render=function(h,w){if(w!==void 0&&w.isCamera!==!0){nt("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(N===!0)return;B!==null&&B.renderStart(h,w);const H=Se.enabled===!0&&Se.isPresenting===!0,F=T!==null&&(te===null||H)&&T.begin(U,te);if(h.matrixWorldAutoUpdate===!0&&h.updateMatrixWorld(),w.parent===null&&w.matrixWorldAutoUpdate===!0&&w.updateMatrixWorld(),Se.enabled===!0&&Se.isPresenting===!0&&(T===null||T.isCompositing()===!1)&&(Se.cameraAutoUpdate===!0&&Se.updateCamera(w),w=Se.getCamera()),h.isScene===!0&&h.onBeforeRender(U,h,w,te),M=ae.get(h,m.length),M.init(w),M.state.textureUnits=k.getTextureUnits(),m.push(M),Fe.multiplyMatrices(w.projectionMatrix,w.matrixWorldInverse),Ie.setFromProjectionMatrix(Fe,Xi,w.reversedDepth),$e=this.localClippingEnabled,He=Te.init(this.clippingPlanes,$e),A=ce.get(h,C.length),A.init(),C.push(A),Se.enabled===!0&&Se.isPresenting===!0){const he=U.xr.getDepthSensingMesh();he!==null&&ti(he,w,-1/0,U.sortObjects)}ti(h,w,0,U.sortObjects),A.finish(),B!==null&&B.updateLights(M.state.lightsArray),U.sortObjects===!0&&A.sort(Ee,Ue),at=Se.enabled===!1||Se.isPresenting===!1||Se.hasDepthSensing()===!1,at&&Pe.addToRenderList(A,h),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),He===!0&&Te.beginShadows();const O=M.state.shadowsArray;if(be.render(O,h,w),He===!0&&Te.endShadows(),(F&&T.hasRenderPass())===!1){const he=A.opaque,fe=A.transmissive;if(M.setupLights(),w.isArrayCamera){const ge=w.cameras;if(fe.length>0)for(let xe=0,De=ge.length;xe<De;xe++){const Ne=ge[xe];Bi(he,fe,h,Ne)}at&&Pe.render(h);for(let xe=0,De=ge.length;xe<De;xe++){const Ne=ge[xe];Oi(A,h,Ne,Ne.viewport)}}else fe.length>0&&Bi(he,fe,h,w),at&&Pe.render(h),Oi(A,h,w)}te!==null&&Y===0&&(k.updateMultisampleRenderTarget(te),k.updateRenderTargetMipmap(te)),F&&T.end(U),h.isScene===!0&&h.onAfterRender(U,h,w),ue.resetDefaultState(),$=-1,J=null,m.pop(),m.length>0?(M=m[m.length-1],k.setTextureUnits(M.state.textureUnits),He===!0&&Te.setGlobalState(U.clippingPlanes,M.state.camera)):M=null,C.pop(),C.length>0?A=C[C.length-1]:A=null,B!==null&&B.renderEnd()};function ti(h,w,H,F){if(h.visible===!1)return;if(h.layers.test(w.layers)){if(h.isGroup)H=h.renderOrder;else if(h.isLOD)h.autoUpdate===!0&&h.update(w);else if(h.isLightProbeGrid)M.pushLightProbeGrid(h);else if(h.isLight)M.pushLight(h),h.castShadow&&M.pushShadow(h);else if(h.isSprite){if(!h.frustumCulled||h.intersectsFrustum(Ie)){F&&ht.setFromMatrixPosition(h.matrixWorld).applyMatrix4(Fe);const he=q.update(h),fe=h.material;fe.visible&&A.push(h,he,fe,H,ht.z,null,w)}}else if((h.isMesh||h.isLine||h.isPoints)&&(!h.frustumCulled||h.intersectsFrustum(Ie))){const he=q.update(h),fe=h.material;if(F&&(h.boundingSphere!==void 0?(h.boundingSphere===null&&h.computeBoundingSphere(),ht.copy(h.boundingSphere.center)):(he.boundingSphere===null&&he.computeBoundingSphere(),ht.copy(he.boundingSphere.center)),ht.applyMatrix4(h.matrixWorld).applyMatrix4(Fe)),Array.isArray(fe)){const ge=he.groups;for(let xe=0,De=ge.length;xe<De;xe++){const Ne=ge[xe],ve=fe[Ne.materialIndex];ve&&ve.visible&&A.push(h,he,ve,H,ht.z,Ne,w)}}else fe.visible&&A.push(h,he,fe,H,ht.z,null,w)}}const de=h.children;for(let he=0,fe=de.length;he<fe;he++)ti(de[he],w,H,F)}function Oi(h,w,H,F){const{opaque:O,transmissive:de,transparent:he}=h;M.setupLightsView(H),He===!0&&Te.setGlobalState(U.clippingPlanes,H),F&&l.viewport(ee.copy(F)),O.length>0&&On(O,w,H),de.length>0&&On(de,w,H),he.length>0&&On(he,w,H),l.buffers.depth.setTest(!0),l.buffers.depth.setMask(!0),l.buffers.color.setMask(!0),l.setPolygonOffset(!1)}function Bi(h,w,H,F){if((H.isScene===!0?H.overrideMaterial:null)!==null)return;if(M.state.transmissionRenderTarget[F.id]===void 0){const ve=ze.has("EXT_color_buffer_half_float")||ze.has("EXT_color_buffer_float");M.state.transmissionRenderTarget[F.id]=new Lt(1,1,{generateMipmaps:!0,type:ve?zt:Ot,minFilter:$t,samples:Math.max(4,x.samples),stencilBuffer:a,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:it.workingColorSpace})}const de=M.state.transmissionRenderTarget[F.id],he=F.viewport||ee;de.setSize(he.z*U.transmissionResolutionScale,he.w*U.transmissionResolutionScale);const fe=U.getRenderTarget(),ge=U.getActiveCubeFace(),xe=U.getActiveMipmapLevel();U.setRenderTarget(de),U.getClearColor(ot),Ke=U.getClearAlpha(),Ke<1&&U.setClearColor(16777215,.5),U.clear(),at&&Pe.render(H);const De=U.toneMapping;U.toneMapping=Gt;const Ne=F.viewport;if(F.viewport!==void 0&&(F.viewport=void 0),M.setupLightsView(F),He===!0&&Te.setGlobalState(U.clippingPlanes,F),On(h,H,F),k.updateMultisampleRenderTarget(de),k.updateRenderTargetMipmap(de),ze.has("WEBGL_multisampled_render_to_texture")===!1){let ve=!1;for(let We=0,ft=w.length;We<ft;We++){const tt=w[We],{object:Ze,geometry:gt,material:pe,group:St}=tt;if(pe.side===Bt&&Ze.layers.test(F.layers)){const Ge=pe.side;pe.side=At,pe.needsUpdate=!0,Gi(Ze,H,F,gt,pe,St),pe.side=Ge,pe.needsUpdate=!0,ve=!0}}ve===!0&&(k.updateMultisampleRenderTarget(de),k.updateRenderTargetMipmap(de))}U.setRenderTarget(fe,ge,xe),U.setClearColor(ot,Ke),Ne!==void 0&&(F.viewport=Ne),U.toneMapping=De}function On(h,w,H){const F=w.isScene===!0?w.overrideMaterial:null;for(let O=0,de=h.length;O<de;O++){const he=h[O],{object:fe,geometry:ge,group:xe}=he;let De=he.material;De.allowOverride===!0&&F!==null&&(De=F),fe.layers.test(H.layers)&&Gi(fe,w,H,ge,De,xe)}}function Gi(h,w,H,F,O,de){B!==null&&O.isNodeMaterial&&B.setObject(h,O),h.onBeforeRender(U,w,H,F,O,de),h.modelViewMatrix.multiplyMatrices(H.matrixWorldInverse,h.matrixWorld),h.normalMatrix.getNormalMatrix(h.modelViewMatrix),O.onBeforeRender(U,w,H,F,h,de),O.transparent===!0&&O.side===Bt&&O.forceSinglePass===!1?(O.side=At,O.needsUpdate=!0,U.renderBufferDirect(H,w,F,O,h,de),O.side=vn,O.needsUpdate=!0,U.renderBufferDirect(H,w,F,O,h,de),O.side=Bt):U.renderBufferDirect(H,w,F,O,h,de),h.onAfterRender(U,w,H,F,O,de)}function Bn(h,w,H){w.isScene!==!0&&(w=Mt);const F=G.get(h),O=M.state.lights,de=M.state.shadowsArray,he=O.state.version,fe=re.getParameters(h,O.state,de,w,H,M.state.lightProbeGridArray),ge=re.getProgramCacheKey(fe);let xe=F.programs;F.environment=h.isMeshStandardMaterial||h.isMeshLambertMaterial||h.isMeshPhongMaterial?w.environment:null,F.fog=w.fog;const De=h.isMeshStandardMaterial||h.isMeshLambertMaterial&&!h.envMap||h.isMeshPhongMaterial&&!h.envMap;F.envMap=ne.get(h.envMap||F.environment,De),F.envMapRotation=F.environment!==null&&h.envMap===null?w.environmentRotation:h.envMapRotation,xe===void 0&&(h.addEventListener("dispose",Ut),xe=new Map,F.programs=xe);let Ne=xe.get(ge);if(Ne!==void 0){if(F.currentProgram===Ne&&F.lightsStateVersion===he)return Vi(h,fe),Ne}else fe.uniforms=re.getUniforms(h),B!==null&&h.isNodeMaterial&&B.build(h,H,fe),h.onBeforeCompile(fe,U),Ne=re.acquireProgram(fe,ge),xe.set(ge,Ne),F.uniforms=fe.uniforms;const ve=F.uniforms;return(!h.isShaderMaterial&&!h.isRawShaderMaterial||h.clipping===!0)&&(ve.clippingPlanes=Te.uniform),Vi(h,fe),F.needsLights=io(h),F.lightsStateVersion=he,F.needsLights&&(ve.ambientLightColor.value=O.state.ambient,ve.lightProbe.value=O.state.probe,ve.sunLights.value=O.state.sun,ve.sunLightShadows.value=O.state.sunShadow,ve.directionalLights.value=O.state.directional,ve.directionalLightShadows.value=O.state.directionalShadow,ve.spotLights.value=O.state.spot,ve.spotLightShadows.value=O.state.spotShadow,ve.rectAreaLights.value=O.state.rectArea,ve.ltc_1.value=O.state.rectAreaLTC1,ve.ltc_2.value=O.state.rectAreaLTC2,ve.pointLights.value=O.state.point,ve.pointLightShadows.value=O.state.pointShadow,ve.hemisphereLights.value=O.state.hemi,ve.sunShadowMatrix.value=O.state.sunShadowMatrix,ve.sunShadowCascade.value=O.state.sunShadowCascade,ve.directionalShadowMatrix.value=O.state.directionalShadowMatrix,ve.spotLightMatrix.value=O.state.spotLightMatrix,ve.spotLightMap.value=O.state.spotLightMap,ve.pointShadowMatrix.value=O.state.pointShadowMatrix),F.lightProbeGrid=M.state.lightProbeGridArray.length>0,F.currentProgram=Ne,F.uniformsList=null,Ne}function Hi(h){if(h.uniformsList===null){const w=h.currentProgram.getUniforms();h.uniformsList=Xn.seqWithValue(w.seq,h.uniforms)}return h.uniformsList}function Vi(h,w){const H=G.get(h);H.outputColorSpace=w.outputColorSpace,H.batching=w.batching,H.batchingColor=w.batchingColor,H.instancing=w.instancing,H.instancingColor=w.instancingColor,H.instancingMorph=w.instancingMorph,H.skinning=w.skinning,H.morphTargets=w.morphTargets,H.morphNormals=w.morphNormals,H.morphColors=w.morphColors,H.morphTargetsCount=w.morphTargetsCount,H.numClippingPlanes=w.numClippingPlanes,H.numIntersection=w.numClipIntersection,H.vertexAlphas=w.vertexAlphas,H.vertexTangents=w.vertexTangents,H.toneMapping=w.toneMapping}function eo(h,w){if(h.length===0)return null;if(h.length===1)return h[0].texture!==null?h[0]:null;S.setFromMatrixPosition(w.matrixWorld);for(let H=0,F=h.length;H<F;H++){const O=h[H];if(O.texture!==null&&O.boundingBox.containsPoint(S))return O}return null}function to(h,w,H,F,O){w.isScene!==!0&&(w=Mt),k.resetTextureUnits();const de=w.fog,he=F.isMeshStandardMaterial||F.isMeshLambertMaterial||F.isMeshPhongMaterial?w.environment:null,fe=te===null?U.outputColorSpace:te.isXRRenderTarget===!0?te.texture.colorSpace:it.workingColorSpace,ge=F.isMeshStandardMaterial||F.isMeshLambertMaterial&&!F.envMap||F.isMeshPhongMaterial&&!F.envMap,xe=ne.get(F.envMap||he,ge),De=F.vertexColors===!0&&!!H.attributes.color&&H.attributes.color.itemSize===4,Ne=!!H.attributes.tangent&&(!!F.normalMap||F.anisotropy>0),ve=!!H.morphAttributes.position,We=!!H.morphAttributes.normal,ft=!!H.morphAttributes.color;let tt=Gt;F.toneMapped&&(te===null||te.isXRRenderTarget===!0)&&(tt=U.toneMapping);const Ze=H.morphAttributes.position||H.morphAttributes.normal||H.morphAttributes.color,gt=Ze!==void 0?Ze.length:0,pe=G.get(F),St=M.state.lights;if(He===!0&&($e===!0||h!==J)){const Qe=h===J&&F.id===$;Te.setState(F,h,Qe)}let Ge=!1;F.version===pe.__version?(pe.needsLights&&pe.lightsStateVersion!==St.state.version||pe.outputColorSpace!==fe||O.isBatchedMesh&&pe.batching===!1||!O.isBatchedMesh&&pe.batching===!0||O.isBatchedMesh&&pe.batchingColor===!0&&O._colorsTexture===null||O.isBatchedMesh&&pe.batchingColor===!1&&O._colorsTexture!==null||O.isInstancedMesh&&pe.instancing===!1||!O.isInstancedMesh&&pe.instancing===!0||O.isSkinnedMesh&&pe.skinning===!1||!O.isSkinnedMesh&&pe.skinning===!0||O.isInstancedMesh&&pe.instancingColor===!0&&O.instanceColor===null||O.isInstancedMesh&&pe.instancingColor===!1&&O.instanceColor!==null||O.isInstancedMesh&&pe.instancingMorph===!0&&O.morphTexture===null||O.isInstancedMesh&&pe.instancingMorph===!1&&O.morphTexture!==null||pe.envMap!==xe||F.fog===!0&&pe.fog!==de||pe.numClippingPlanes!==void 0&&(pe.numClippingPlanes!==Te.numPlanes||pe.numIntersection!==Te.numIntersection)||pe.vertexAlphas!==De||pe.vertexTangents!==Ne||pe.morphTargets!==ve||pe.morphNormals!==We||pe.morphColors!==ft||pe.toneMapping!==tt||pe.morphTargetsCount!==gt||!!pe.lightProbeGrid!=M.state.lightProbeGridArray.length>0)&&(Ge=!0):(Ge=!0,pe.__version=F.version);let bt=pe.currentProgram;Ge===!0&&(bt=Bn(F,w,O),B&&F.isNodeMaterial&&B.onUpdateProgram(F,bt,pe));let yt=!1,Kt=!1,sn=!1;const Ye=bt.getUniforms(),st=pe.uniforms;if(l.useProgram(bt.program)&&(yt=!0,Kt=!0,sn=!0),F.id!==$&&($=F.id,Kt=!0),pe.needsLights){const Qe=eo(M.state.lightProbeGridArray,O);pe.lightProbeGrid!==Qe&&(pe.lightProbeGrid=Qe,Kt=!0)}if(yt||J!==h){l.buffers.depth.getReversed()&&h.reversedDepth!==!0&&(h._reversedDepth=!0,h.updateProjectionMatrix()),Ye.setValue(L,"projectionMatrix",h.projectionMatrix),Ye.setValue(L,"viewMatrix",h.matrixWorldInverse);const Yt=Ye.map.cameraPosition;Yt!==void 0&&Yt.setValue(L,rt.setFromMatrixPosition(h.matrixWorld)),x.logarithmicDepthBuffer&&Ye.setValue(L,"logDepthBufFC",2/(Math.log(h.far+1)/Math.LN2)),(F.isMeshPhongMaterial||F.isMeshToonMaterial||F.isMeshLambertMaterial||F.isMeshBasicMaterial||F.isMeshStandardMaterial||F.isShaderMaterial)&&Ye.setValue(L,"isOrthographic",h.isOrthographicCamera===!0),J!==h&&(J=h,Kt=!0,sn=!0)}if(pe.needsLights&&(St.state.sunShadowMap.length>0&&Ye.setValue(L,"sunShadowMap",St.state.sunShadowMap,k),St.state.directionalShadowMap.length>0&&Ye.setValue(L,"directionalShadowMap",St.state.directionalShadowMap,k),St.state.spotShadowMap.length>0&&Ye.setValue(L,"spotShadowMap",St.state.spotShadowMap,k),St.state.pointShadowMap.length>0&&Ye.setValue(L,"pointShadowMap",St.state.pointShadowMap,k)),O.isSkinnedMesh){Ye.setOptional(L,O,"bindMatrix"),Ye.setOptional(L,O,"bindMatrixInverse");const Qe=O.skeleton;Qe&&(Qe.boneTexture===null&&Qe.computeBoneTexture(),Ye.setValue(L,"boneTexture",Qe.boneTexture,k))}O.isBatchedMesh&&(Ye.setOptional(L,O,"batchingTexture"),Ye.setValue(L,"batchingTexture",O._matricesTexture,k),Ye.setOptional(L,O,"batchingIdTexture"),Ye.setValue(L,"batchingIdTexture",O._indirectTexture,k),Ye.setOptional(L,O,"batchingColorTexture"),O._colorsTexture!==null&&Ye.setValue(L,"batchingColorTexture",O._colorsTexture,k));const qt=H.morphAttributes;if((qt.position!==void 0||qt.normal!==void 0||qt.color!==void 0)&&P.update(O,H,bt),(Kt||pe.receiveShadow!==O.receiveShadow)&&(pe.receiveShadow=O.receiveShadow,Ye.setValue(L,"receiveShadow",O.receiveShadow)),(F.isMeshStandardMaterial||F.isMeshLambertMaterial||F.isMeshPhongMaterial)&&F.envMap===null&&w.environment!==null&&(st.envMapIntensity.value=w.environmentIntensity),st.dfgLUT!==void 0&&(st.dfgLUT.value=Ju()),Kt){if(Ye.setValue(L,"toneMappingExposure",U.toneMappingExposure),pe.needsLights&&no(st,sn),de&&F.fog===!0&&Me.refreshFogUniforms(st,de),Me.refreshMaterialUniforms(st,F,j,z,M.state.transmissionRenderTarget[h.id]),pe.needsLights&&pe.lightProbeGrid){const Qe=pe.lightProbeGrid;st.probesSH.value=Qe.texture,st.probesMin.value.copy(Qe.boundingBox.min),st.probesMax.value.copy(Qe.boundingBox.max),st.probesResolution.value.copy(Qe.resolution)}Xn.upload(L,Hi(pe),st,k)}if(F.isShaderMaterial&&F.uniformsNeedUpdate===!0&&(Xn.upload(L,Hi(pe),st,k),F.uniformsNeedUpdate=!1),F.isSpriteMaterial&&Ye.setValue(L,"center",O.center),Ye.setValue(L,"modelViewMatrix",O.modelViewMatrix),Ye.setValue(L,"normalMatrix",O.normalMatrix),Ye.setValue(L,"modelMatrix",O.matrixWorld),F.uniformsGroups!==void 0){const Qe=F.uniformsGroups;for(let Yt=0,cn=Qe.length;Yt<cn;Yt++){const Wi=Qe[Yt];Q.update(Wi,bt),Q.bind(Wi,bt)}}return bt}function no(h,w){h.ambientLightColor.needsUpdate=w,h.lightProbe.needsUpdate=w,h.sunLights.needsUpdate=w,h.sunLightShadows.needsUpdate=w,h.directionalLights.needsUpdate=w,h.directionalLightShadows.needsUpdate=w,h.pointLights.needsUpdate=w,h.pointLightShadows.needsUpdate=w,h.spotLights.needsUpdate=w,h.spotLightShadows.needsUpdate=w,h.rectAreaLights.needsUpdate=w,h.hemisphereLights.needsUpdate=w}function io(h){return h.isMeshLambertMaterial||h.isMeshToonMaterial||h.isMeshPhongMaterial||h.isMeshStandardMaterial||h.isShadowMaterial||h.isShaderMaterial&&h.lights===!0}this.getActiveCubeFace=function(){return Z},this.getActiveMipmapLevel=function(){return Y},this.getRenderTarget=function(){return te},this.setRenderTargetTextures=function(h,w,H){const F=G.get(h);F.__autoAllocateDepthBuffer=h.resolveDepthBuffer===!1,F.__autoAllocateDepthBuffer===!1&&(F.__useRenderToTexture=!1),G.get(h.texture).__webglTexture=w,G.get(h.depthTexture).__webglTexture=F.__autoAllocateDepthBuffer?void 0:H,F.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(h,w){const H=G.get(h);H.__webglFramebuffer=w,H.__useDefaultFramebuffer=w===void 0},this.setRenderTarget=function(h,w=0,H=0){te=h,Z=w,Y=H;let F=null,O=!1,de=!1;if(h){const fe=G.get(h);if(fe.__useDefaultFramebuffer!==void 0){l.bindFramebuffer(L.FRAMEBUFFER,fe.__webglFramebuffer),ee.copy(h.viewport),we.copy(h.scissor),Ce=h.scissorTest,l.viewport(ee),l.scissor(we),l.setScissorTest(Ce),$=-1;return}else if(fe.__webglFramebuffer===void 0)k.setupRenderTarget(h);else if(fe.__hasExternalTextures)k.rebindTextures(h,G.get(h.texture).__webglTexture,G.get(h.depthTexture).__webglTexture);else if(h.depthBuffer){const De=h.depthTexture;if(fe.__boundDepthTexture!==De){if(De!==null&&G.has(De)&&(h.width!==De.image.width||h.height!==De.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");k.setupDepthRenderbuffer(h)}}const ge=h.texture;(ge.isData3DTexture||ge.isDataArrayTexture||ge.isCompressedArrayTexture)&&(de=!0);const xe=G.get(h).__webglFramebuffer;h.isWebGLCubeRenderTarget?(Array.isArray(xe[w])?F=xe[w][H]:F=xe[w],O=!0):h.samples>0&&k.useMultisampledRTT(h)===!1?F=G.get(h).__webglMultisampledFramebuffer:Array.isArray(xe)?F=xe[H]:F=xe,ee.copy(h.viewport),we.copy(h.scissor),Ce=h.scissorTest}else ee.copy(_e).multiplyScalar(j).floor(),we.copy(Be).multiplyScalar(j).floor(),Ce=dt;if(H!==0&&(F=V),l.bindFramebuffer(L.FRAMEBUFFER,F)&&l.drawBuffers(h,F),l.viewport(ee),l.scissor(we),l.setScissorTest(Ce),O){const fe=G.get(h.texture);L.framebufferTexture2D(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_CUBE_MAP_POSITIVE_X+w,fe.__webglTexture,H)}else if(de){const fe=w;for(let ge=0;ge<h.textures.length;ge++){const xe=G.get(h.textures[ge]);L.framebufferTextureLayer(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0+ge,xe.__webglTexture,H,fe)}}else if(h!==null&&H!==0){const fe=G.get(h.texture);L.framebufferTexture2D(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,fe.__webglTexture,H)}$=-1};function ki(h){const w=G.get(h);return(w.__readFormat!==h.format||w.__readType!==h.type)&&(w.__readFormat=h.format,w.__readType=h.type,w.__formatReadable=x.textureFormatReadable(h.format),w.__typeReadable=x.textureTypeReadable(h.type)),w}this.readRenderTargetPixels=function(h,w,H,F,O,de,he,fe=0){if(!(h&&h.isWebGLRenderTarget)){nt("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let ge=G.get(h).__webglFramebuffer;if(h.isWebGLCubeRenderTarget&&he!==void 0&&(ge=ge[he]),ge){l.bindFramebuffer(L.FRAMEBUFFER,ge);try{const xe=h.textures[fe],De=xe.format,Ne=xe.type;h.textures.length>1&&L.readBuffer(L.COLOR_ATTACHMENT0+fe);const ve=ki(xe);if(ve.__formatReadable===!1){nt("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(ve.__typeReadable===!1){nt("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}w>=0&&w<=h.width-F&&H>=0&&H<=h.height-O&&L.readPixels(w,H,F,O,se.convert(De),se.convert(Ne),de)}finally{const xe=te!==null?G.get(te).__webglFramebuffer:null;l.bindFramebuffer(L.FRAMEBUFFER,xe)}}},this.readRenderTargetPixelsAsync=async function(h,w,H,F,O,de,he,fe=0){if(!(h&&h.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let ge=G.get(h).__webglFramebuffer;if(h.isWebGLCubeRenderTarget&&he!==void 0&&(ge=ge[he]),ge)if(w>=0&&w<=h.width-F&&H>=0&&H<=h.height-O){l.bindFramebuffer(L.FRAMEBUFFER,ge);const xe=h.textures[fe],De=xe.format,Ne=xe.type;h.textures.length>1&&L.readBuffer(L.COLOR_ATTACHMENT0+fe);const ve=ki(xe);if(ve.__formatReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(ve.__typeReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");const We=L.createBuffer();L.bindBuffer(L.PIXEL_PACK_BUFFER,We),L.bufferData(L.PIXEL_PACK_BUFFER,de.byteLength,L.STREAM_READ),L.readPixels(w,H,F,O,se.convert(De),se.convert(Ne),0),L.bindBuffer(L.PIXEL_PACK_BUFFER,null);const ft=te!==null?G.get(te).__webglFramebuffer:null;l.bindFramebuffer(L.FRAMEBUFFER,ft);const tt=L.fenceSync(L.SYNC_GPU_COMMANDS_COMPLETE,0);return L.flush(),await co(L,tt,4),L.bindBuffer(L.PIXEL_PACK_BUFFER,We),L.getBufferSubData(L.PIXEL_PACK_BUFFER,0,de),L.bindBuffer(L.PIXEL_PACK_BUFFER,null),L.deleteBuffer(We),L.deleteSync(tt),de}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(h,w=null,H=0){const F=Math.pow(2,-H),O=Math.floor(h.image.width*F),de=Math.floor(h.image.height*F),he=w!==null?w.x:0,fe=w!==null?w.y:0;k.setTexture2D(h,0),L.copyTexSubImage2D(L.TEXTURE_2D,H,0,0,he,fe,O,de),l.unbindTexture()},this.copyTextureToTexture=function(h,w,H=null,F=null,O=0,de=0){let he,fe,ge,xe,De,Ne,ve,We,ft;const tt=h.isCompressedTexture?h.mipmaps[de]:h.image;if(H!==null)he=H.max.x-H.min.x,fe=H.max.y-H.min.y,ge=H.isBox3?H.max.z-H.min.z:1,xe=H.min.x,De=H.min.y,Ne=H.isBox3?H.min.z:0;else{const st=Math.pow(2,-O);he=Math.floor(tt.width*st),fe=Math.floor(tt.height*st),h.isDataArrayTexture?ge=tt.depth:h.isData3DTexture?ge=Math.floor(tt.depth*st):ge=1,xe=0,De=0,Ne=0}F!==null?(ve=F.x,We=F.y,ft=F.z):(ve=0,We=0,ft=0);const Ze=se.convert(w.format),gt=se.convert(w.type);let pe;w.isData3DTexture?(k.setTexture3D(w,0),pe=L.TEXTURE_3D):w.isDataArrayTexture||w.isCompressedArrayTexture?(k.setTexture2DArray(w,0),pe=L.TEXTURE_2D_ARRAY):(k.setTexture2D(w,0),pe=L.TEXTURE_2D),l.activeTexture(L.TEXTURE0),l.pixelStorei(L.UNPACK_FLIP_Y_WEBGL,w.flipY),l.pixelStorei(L.UNPACK_PREMULTIPLY_ALPHA_WEBGL,w.premultiplyAlpha),l.pixelStorei(L.UNPACK_ALIGNMENT,w.unpackAlignment);const St=l.getParameter(L.UNPACK_ROW_LENGTH),Ge=l.getParameter(L.UNPACK_IMAGE_HEIGHT),bt=l.getParameter(L.UNPACK_SKIP_PIXELS),yt=l.getParameter(L.UNPACK_SKIP_ROWS),Kt=l.getParameter(L.UNPACK_SKIP_IMAGES);l.pixelStorei(L.UNPACK_ROW_LENGTH,tt.width),l.pixelStorei(L.UNPACK_IMAGE_HEIGHT,tt.height),l.pixelStorei(L.UNPACK_SKIP_PIXELS,xe),l.pixelStorei(L.UNPACK_SKIP_ROWS,De),l.pixelStorei(L.UNPACK_SKIP_IMAGES,Ne);const sn=h.isDataArrayTexture||h.isData3DTexture,Ye=w.isDataArrayTexture||w.isData3DTexture;if(h.isDepthTexture){const st=G.get(h),qt=G.get(w),Qe=G.get(st.__renderTarget),Yt=G.get(qt.__renderTarget);l.bindFramebuffer(L.READ_FRAMEBUFFER,Qe.__webglFramebuffer),l.bindFramebuffer(L.DRAW_FRAMEBUFFER,Yt.__webglFramebuffer);for(let cn=0;cn<ge;cn++)sn&&(L.framebufferTextureLayer(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,G.get(h).__webglTexture,O,Ne+cn),L.framebufferTextureLayer(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,G.get(w).__webglTexture,de,ft+cn)),L.blitFramebuffer(xe,De,he,fe,ve,We,he,fe,L.DEPTH_BUFFER_BIT,L.NEAREST);l.bindFramebuffer(L.READ_FRAMEBUFFER,null),l.bindFramebuffer(L.DRAW_FRAMEBUFFER,null)}else if(O!==0||h.isRenderTargetTexture||G.has(h)){const st=G.get(h),qt=G.get(w);l.bindFramebuffer(L.READ_FRAMEBUFFER,I),l.bindFramebuffer(L.DRAW_FRAMEBUFFER,X);for(let Qe=0;Qe<ge;Qe++)sn?L.framebufferTextureLayer(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,st.__webglTexture,O,Ne+Qe):L.framebufferTexture2D(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,st.__webglTexture,O),Ye?L.framebufferTextureLayer(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,qt.__webglTexture,de,ft+Qe):L.framebufferTexture2D(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,qt.__webglTexture,de),O!==0?L.blitFramebuffer(xe,De,he,fe,ve,We,he,fe,L.COLOR_BUFFER_BIT,L.NEAREST):Ye?L.copyTexSubImage3D(pe,de,ve,We,ft+Qe,xe,De,he,fe):L.copyTexSubImage2D(pe,de,ve,We,xe,De,he,fe);l.bindFramebuffer(L.READ_FRAMEBUFFER,null),l.bindFramebuffer(L.DRAW_FRAMEBUFFER,null)}else Ye?h.isDataTexture||h.isData3DTexture?L.texSubImage3D(pe,de,ve,We,ft,he,fe,ge,Ze,gt,tt.data):w.isCompressedArrayTexture?L.compressedTexSubImage3D(pe,de,ve,We,ft,he,fe,ge,Ze,tt.data):L.texSubImage3D(pe,de,ve,We,ft,he,fe,ge,Ze,gt,tt):h.isDataTexture?L.texSubImage2D(L.TEXTURE_2D,de,ve,We,he,fe,Ze,gt,tt.data):h.isCompressedTexture?L.compressedTexSubImage2D(L.TEXTURE_2D,de,ve,We,tt.width,tt.height,Ze,tt.data):L.texSubImage2D(L.TEXTURE_2D,de,ve,We,he,fe,Ze,gt,tt);l.pixelStorei(L.UNPACK_ROW_LENGTH,St),l.pixelStorei(L.UNPACK_IMAGE_HEIGHT,Ge),l.pixelStorei(L.UNPACK_SKIP_PIXELS,bt),l.pixelStorei(L.UNPACK_SKIP_ROWS,yt),l.pixelStorei(L.UNPACK_SKIP_IMAGES,Kt),de===0&&w.generateMipmaps&&L.generateMipmap(pe),l.unbindTexture()},this.initRenderTarget=function(h){G.get(h).__webglFramebuffer===void 0&&k.setupRenderTarget(h)},this.initTexture=function(h){h.isCubeTexture?k.setTextureCube(h,0):h.isData3DTexture?k.setTexture3D(h,0):h.isDataArrayTexture||h.isCompressedArrayTexture?k.setTexture2DArray(h,0):k.setTexture2D(h,0),l.unbindTexture()},this.resetState=function(){Z=0,Y=0,te=null,l.reset(),ue.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Xi}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(n){this._outputColorSpace=n;const t=this.getContext();t.drawingBufferColorSpace=it._getDrawingBufferColorSpace(n),t.unpackColorSpace=it._getUnpackColorSpace()}}function ra(e,n){if(n===Es)return console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles."),e;if(n===Ti||n===Da){let t=e.getIndex();if(t===null){const a=[],o=e.getAttribute("position");if(o!==void 0){for(let s=0;s<o.count;s++)a.push(s);e.setIndex(a),t=e.getIndex()}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible."),e}const i=t.count-2,r=[];if(n===Ti)for(let a=1;a<=i;a++)r.push(t.getX(0)),r.push(t.getX(a)),r.push(t.getX(a+1));else for(let a=0;a<i;a++)a%2===0?(r.push(t.getX(a)),r.push(t.getX(a+1)),r.push(t.getX(a+2))):(r.push(t.getX(a+2)),r.push(t.getX(a+1)),r.push(t.getX(a)));return r.length/3!==i&&console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles."),e.setIndex(r),e.clearGroups(),e}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:",n),e}function tp(e){const n=new Map,t=new Map,i=e.clone();return Ya(e,i,function(r,a){n.set(a,r),t.set(r,a)}),i.traverse(function(r){if(!r.isSkinnedMesh)return;const a=r,o=n.get(r),s=o.skeleton.bones;a.skeleton=o.skeleton.clone(),a.bindMatrix.copy(o.bindMatrix),a.skeleton.bones=s.map(function(c){return t.get(c)}),a.bind(a.skeleton,a.bindMatrix)}),i}function Ya(e,n,t){t(e,n);for(let i=0;i<e.children.length;i++)Ya(e.children[i],n.children[i],t)}class np extends Ms{constructor(n){super(n),this.dracoLoader=null,this.ktx2Loader=null,this.meshoptDecoder=null,this.pluginCallbacks=[],this.register(function(t){return new sp(t)}),this.register(function(t){return new cp(t)}),this.register(function(t){return new gp(t)}),this.register(function(t){return new vp(t)}),this.register(function(t){return new Sp(t)}),this.register(function(t){return new fp(t)}),this.register(function(t){return new dp(t)}),this.register(function(t){return new up(t)}),this.register(function(t){return new pp(t)}),this.register(function(t){return new op(t)}),this.register(function(t){return new hp(t)}),this.register(function(t){return new lp(t)}),this.register(function(t){return new _p(t)}),this.register(function(t){return new mp(t)}),this.register(function(t){return new rp(t)}),this.register(function(t){return new aa(t,ye.EXT_MESHOPT_COMPRESSION)}),this.register(function(t){return new aa(t,ye.KHR_MESHOPT_COMPRESSION)}),this.register(function(t){return new xp(t)})}load(n,t,i,r){const a=this;let o;if(this.resourcePath!=="")o=this.resourcePath;else if(this.path!==""){const d=In.extractUrlBase(n);o=In.resolveURL(d,this.path)}else o=In.extractUrlBase(n);this.manager.itemStart(n);const s=function(d){r?r(d):console.error(d),a.manager.itemError(n),a.manager.itemEnd(n)},c=new Ua(this.manager);c.setPath(this.path),c.setResponseType("arraybuffer"),c.setRequestHeader(this.requestHeader),c.setWithCredentials(this.withCredentials),c.load(n,function(d){try{a.parse(d,o,function(g){t(g),a.manager.itemEnd(n)},s)}catch(g){s(g)}},i,s)}setDRACOLoader(n){return this.dracoLoader=n,this}setKTX2Loader(n){return this.ktx2Loader=n,this}setMeshoptDecoder(n){return this.meshoptDecoder=n,this}register(n){return this.pluginCallbacks.indexOf(n)===-1&&this.pluginCallbacks.push(n),this}unregister(n){return this.pluginCallbacks.indexOf(n)!==-1&&this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(n),1),this}parse(n,t,i,r){let a;const o={},s={},c=new TextDecoder;if(typeof n=="string")a=JSON.parse(n);else if(n instanceof ArrayBuffer)if(c.decode(new Uint8Array(n,0,4))===Za){try{o[ye.KHR_BINARY_GLTF]=new Ep(n)}catch(_){r&&r(_);return}a=JSON.parse(o[ye.KHR_BINARY_GLTF].content)}else a=JSON.parse(c.decode(n));else a=n;if(a.asset===void 0||a.asset.version[0]<2){r&&r(new Error("THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported."));return}const d=new Ip(a,{path:t||this.resourcePath||"",crossOrigin:this.crossOrigin,requestHeader:this.requestHeader,manager:this.manager,ktx2Loader:this.ktx2Loader,meshoptDecoder:this.meshoptDecoder});d.fileLoader.setRequestHeader(this.requestHeader);for(let g=0;g<this.pluginCallbacks.length;g++){const _=this.pluginCallbacks[g](d);_.name||console.error("THREE.GLTFLoader: Invalid plugin found: missing name"),s[_.name]=_,o[_.name]=!0}if(a.extensionsUsed)for(let g=0;g<a.extensionsUsed.length;++g){const _=a.extensionsUsed[g],p=a.extensionsRequired||[];switch(_){case ye.KHR_MATERIALS_UNLIT:o[_]=new ap;break;case ye.KHR_DRACO_MESH_COMPRESSION:o[_]=new Mp(a,this.dracoLoader);break;case ye.KHR_TEXTURE_TRANSFORM:o[_]=new Tp;break;case ye.KHR_MESH_QUANTIZATION:o[_]=new Ap;break;default:p.indexOf(_)>=0&&s[_]===void 0&&console.warn('THREE.GLTFLoader: Unknown extension "'+_+'".')}}d.setExtensions(o),d.setPlugins(s),d.parse(i,r)}parseAsync(n,t){const i=this;return new Promise(function(r,a){i.parse(n,t,r,a)})}}function ip(){let e={};return{get:function(n){return e[n]},add:function(n,t){e[n]=t},remove:function(n){delete e[n]},removeAll:function(){e={}}}}function ct(e,n,t){const i=e.json.materials[n];return i.extensions&&i.extensions[t]?i.extensions[t]:null}const ye={KHR_BINARY_GLTF:"KHR_binary_glTF",KHR_DRACO_MESH_COMPRESSION:"KHR_draco_mesh_compression",KHR_LIGHTS_PUNCTUAL:"KHR_lights_punctual",KHR_MATERIALS_CLEARCOAT:"KHR_materials_clearcoat",KHR_MATERIALS_DISPERSION:"KHR_materials_dispersion",KHR_MATERIALS_IOR:"KHR_materials_ior",KHR_MATERIALS_SHEEN:"KHR_materials_sheen",KHR_MATERIALS_SPECULAR:"KHR_materials_specular",KHR_MATERIALS_TRANSMISSION:"KHR_materials_transmission",KHR_MATERIALS_IRIDESCENCE:"KHR_materials_iridescence",KHR_MATERIALS_ANISOTROPY:"KHR_materials_anisotropy",KHR_MATERIALS_UNLIT:"KHR_materials_unlit",KHR_MATERIALS_VOLUME:"KHR_materials_volume",KHR_TEXTURE_BASISU:"KHR_texture_basisu",KHR_TEXTURE_TRANSFORM:"KHR_texture_transform",KHR_MESH_QUANTIZATION:"KHR_mesh_quantization",KHR_MATERIALS_EMISSIVE_STRENGTH:"KHR_materials_emissive_strength",EXT_MATERIALS_BUMP:"EXT_materials_bump",EXT_TEXTURE_WEBP:"EXT_texture_webp",EXT_TEXTURE_AVIF:"EXT_texture_avif",EXT_MESHOPT_COMPRESSION:"EXT_meshopt_compression",KHR_MESHOPT_COMPRESSION:"KHR_meshopt_compression",EXT_MESH_GPU_INSTANCING:"EXT_mesh_gpu_instancing"};class rp{constructor(n){this.parser=n,this.name=ye.KHR_LIGHTS_PUNCTUAL,this.cache={refs:{},uses:{}}}_markDefs(){const n=this.parser,t=this.parser.json.nodes||[];for(let i=0,r=t.length;i<r;i++){const a=t[i];a.extensions&&a.extensions[this.name]&&a.extensions[this.name].light!==void 0&&n._addNodeRef(this.cache,a.extensions[this.name].light)}}_loadLight(n){const t=this.parser,i="light:"+n;let r=t.cache.get(i);if(r)return r;const a=t.json,c=((a.extensions&&a.extensions[this.name]||{}).lights||[])[n];let d;const g=new Ve(16777215);c.color!==void 0&&g.setRGB(c.color[0],c.color[1],c.color[2],Dt);const _=c.range!==void 0?c.range:0;switch(c.type){case"directional":d=new Ia(g),d.target.position.set(0,0,-1),d.add(d.target);break;case"point":d=new ya(g),d.distance=_;break;case"spot":d=new Ts(g),d.distance=_,c.spot=c.spot||{},c.spot.innerConeAngle=c.spot.innerConeAngle!==void 0?c.spot.innerConeAngle:0,c.spot.outerConeAngle=c.spot.outerConeAngle!==void 0?c.spot.outerConeAngle:Math.PI/4,d.angle=c.spot.outerConeAngle,d.penumbra=1-c.spot.innerConeAngle/c.spot.outerConeAngle,d.target.position.set(0,0,-1),d.add(d.target);break;default:throw new Error("THREE.GLTFLoader: Unexpected light type: "+c.type)}return d.position.set(0,0,0),Nt(d,c),c.intensity!==void 0&&(d.intensity=c.intensity),d.name=t.createUniqueName(c.name||"light_"+n),r=Promise.resolve(d),t.cache.add(i,r),r}getDependency(n,t){if(n==="light")return this._loadLight(t)}createNodeAttachment(n){const t=this,i=this.parser,a=i.json.nodes[n],s=(a.extensions&&a.extensions[this.name]||{}).light;return s===void 0?null:this._loadLight(s).then(function(c){return i._getNodeRef(t.cache,s,c)})}}class ap{constructor(){this.name=ye.KHR_MATERIALS_UNLIT}getMaterialType(){return un}extendParams(n,t,i){const r=[];n.color=new Ve(1,1,1),n.opacity=1;const a=t.pbrMetallicRoughness;if(a){if(Array.isArray(a.baseColorFactor)){const o=a.baseColorFactor;n.color.setRGB(o[0],o[1],o[2],Dt),n.opacity=o[3]}a.baseColorTexture!==void 0&&r.push(i.assignTexture(n,"map",a.baseColorTexture,Pt))}return Promise.all(r)}}class op{constructor(n){this.parser=n,this.name=ye.KHR_MATERIALS_EMISSIVE_STRENGTH}extendMaterialParams(n,t){const i=ct(this.parser,n,this.name);return i===null||i.emissiveStrength!==void 0&&(t.emissiveIntensity=i.emissiveStrength),Promise.resolve()}}class sp{constructor(n){this.parser=n,this.name=ye.KHR_MATERIALS_CLEARCOAT}getMaterialType(n){return ct(this.parser,n,this.name)!==null?Rt:null}extendMaterialParams(n,t){const i=ct(this.parser,n,this.name);if(i===null)return Promise.resolve();const r=[];if(i.clearcoatFactor!==void 0&&(t.clearcoat=i.clearcoatFactor),i.clearcoatTexture!==void 0&&r.push(this.parser.assignTexture(t,"clearcoatMap",i.clearcoatTexture)),i.clearcoatRoughnessFactor!==void 0&&(t.clearcoatRoughness=i.clearcoatRoughnessFactor),i.clearcoatRoughnessTexture!==void 0&&r.push(this.parser.assignTexture(t,"clearcoatRoughnessMap",i.clearcoatRoughnessTexture)),i.clearcoatNormalTexture!==void 0&&(r.push(this.parser.assignTexture(t,"clearcoatNormalMap",i.clearcoatNormalTexture)),i.clearcoatNormalTexture.scale!==void 0)){const a=i.clearcoatNormalTexture.scale;t.clearcoatNormalScale=new mt(a,a)}return Promise.all(r)}}class cp{constructor(n){this.parser=n,this.name=ye.KHR_MATERIALS_DISPERSION}getMaterialType(n){return ct(this.parser,n,this.name)!==null?Rt:null}extendMaterialParams(n,t){const i=ct(this.parser,n,this.name);return i===null||(t.dispersion=i.dispersion!==void 0?i.dispersion:0),Promise.resolve()}}class lp{constructor(n){this.parser=n,this.name=ye.KHR_MATERIALS_IRIDESCENCE}getMaterialType(n){return ct(this.parser,n,this.name)!==null?Rt:null}extendMaterialParams(n,t){const i=ct(this.parser,n,this.name);if(i===null)return Promise.resolve();const r=[];return i.iridescenceFactor!==void 0&&(t.iridescence=i.iridescenceFactor),i.iridescenceTexture!==void 0&&r.push(this.parser.assignTexture(t,"iridescenceMap",i.iridescenceTexture)),i.iridescenceIor!==void 0&&(t.iridescenceIOR=i.iridescenceIor),t.iridescenceThicknessRange===void 0&&(t.iridescenceThicknessRange=[100,400]),i.iridescenceThicknessMinimum!==void 0&&(t.iridescenceThicknessRange[0]=i.iridescenceThicknessMinimum),i.iridescenceThicknessMaximum!==void 0&&(t.iridescenceThicknessRange[1]=i.iridescenceThicknessMaximum),i.iridescenceThicknessTexture!==void 0&&r.push(this.parser.assignTexture(t,"iridescenceThicknessMap",i.iridescenceThicknessTexture)),Promise.all(r)}}class fp{constructor(n){this.parser=n,this.name=ye.KHR_MATERIALS_SHEEN}getMaterialType(n){return ct(this.parser,n,this.name)!==null?Rt:null}extendMaterialParams(n,t){const i=ct(this.parser,n,this.name);if(i===null)return Promise.resolve();const r=[];if(t.sheenColor=new Ve(0,0,0),t.sheenRoughness=0,t.sheen=1,i.sheenColorFactor!==void 0){const a=i.sheenColorFactor;t.sheenColor.setRGB(a[0],a[1],a[2],Dt)}return i.sheenRoughnessFactor!==void 0&&(t.sheenRoughness=i.sheenRoughnessFactor),i.sheenColorTexture!==void 0&&r.push(this.parser.assignTexture(t,"sheenColorMap",i.sheenColorTexture,Pt)),i.sheenRoughnessTexture!==void 0&&r.push(this.parser.assignTexture(t,"sheenRoughnessMap",i.sheenRoughnessTexture)),Promise.all(r)}}class dp{constructor(n){this.parser=n,this.name=ye.KHR_MATERIALS_TRANSMISSION}getMaterialType(n){return ct(this.parser,n,this.name)!==null?Rt:null}extendMaterialParams(n,t){const i=ct(this.parser,n,this.name);if(i===null)return Promise.resolve();const r=[];return i.transmissionFactor!==void 0&&(t.transmission=i.transmissionFactor),i.transmissionTexture!==void 0&&r.push(this.parser.assignTexture(t,"transmissionMap",i.transmissionTexture)),Promise.all(r)}}class up{constructor(n){this.parser=n,this.name=ye.KHR_MATERIALS_VOLUME}getMaterialType(n){return ct(this.parser,n,this.name)!==null?Rt:null}extendMaterialParams(n,t){const i=ct(this.parser,n,this.name);if(i===null)return Promise.resolve();const r=[];t.thickness=i.thicknessFactor!==void 0?i.thicknessFactor:0,i.thicknessTexture!==void 0&&r.push(this.parser.assignTexture(t,"thicknessMap",i.thicknessTexture)),t.attenuationDistance=i.attenuationDistance||1/0;const a=i.attenuationColor||[1,1,1];return t.attenuationColor=new Ve().setRGB(a[0],a[1],a[2],Dt),Promise.all(r)}}class pp{constructor(n){this.parser=n,this.name=ye.KHR_MATERIALS_IOR}getMaterialType(n){return ct(this.parser,n,this.name)!==null?Rt:null}extendMaterialParams(n,t){const i=ct(this.parser,n,this.name);return i===null||(t.ior=i.ior!==void 0?i.ior:1.5,t.ior===0&&(t.ior=1e3)),Promise.resolve()}}class hp{constructor(n){this.parser=n,this.name=ye.KHR_MATERIALS_SPECULAR}getMaterialType(n){return ct(this.parser,n,this.name)!==null?Rt:null}extendMaterialParams(n,t){const i=ct(this.parser,n,this.name);if(i===null)return Promise.resolve();const r=[];t.specularIntensity=i.specularFactor!==void 0?i.specularFactor:1,i.specularTexture!==void 0&&r.push(this.parser.assignTexture(t,"specularIntensityMap",i.specularTexture));const a=i.specularColorFactor||[1,1,1];return t.specularColor=new Ve().setRGB(a[0],a[1],a[2],Dt),i.specularColorTexture!==void 0&&r.push(this.parser.assignTexture(t,"specularColorMap",i.specularColorTexture,Pt)),Promise.all(r)}}class mp{constructor(n){this.parser=n,this.name=ye.EXT_MATERIALS_BUMP}getMaterialType(n){return ct(this.parser,n,this.name)!==null?Rt:null}extendMaterialParams(n,t){const i=ct(this.parser,n,this.name);if(i===null)return Promise.resolve();const r=[];return t.bumpScale=i.bumpFactor!==void 0?i.bumpFactor:1,i.bumpTexture!==void 0&&r.push(this.parser.assignTexture(t,"bumpMap",i.bumpTexture)),Promise.all(r)}}class _p{constructor(n){this.parser=n,this.name=ye.KHR_MATERIALS_ANISOTROPY}getMaterialType(n){return ct(this.parser,n,this.name)!==null?Rt:null}extendMaterialParams(n,t){const i=ct(this.parser,n,this.name);if(i===null)return Promise.resolve();const r=[];return i.anisotropyStrength!==void 0&&(t.anisotropy=i.anisotropyStrength),i.anisotropyRotation!==void 0&&(t.anisotropyRotation=i.anisotropyRotation),i.anisotropyTexture!==void 0&&r.push(this.parser.assignTexture(t,"anisotropyMap",i.anisotropyTexture)),Promise.all(r)}}class gp{constructor(n){this.parser=n,this.name=ye.KHR_TEXTURE_BASISU}loadTexture(n){const t=this.parser,i=t.json,r=i.textures[n];if(!r.extensions||!r.extensions[this.name])return null;const a=r.extensions[this.name],o=t.options.ktx2Loader;if(!o){if(i.extensionsRequired&&i.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures");return null}return t.loadTextureImage(n,a.source,o)}}class vp{constructor(n){this.parser=n,this.name=ye.EXT_TEXTURE_WEBP}loadTexture(n){const t=this.name,i=this.parser,r=i.json,a=r.textures[n];if(!a.extensions||!a.extensions[t])return null;const o=a.extensions[t],s=r.images[o.source];let c=i.textureLoader;if(s.uri){const d=i.options.manager.getHandler(s.uri);d!==null&&(c=d)}return i.loadTextureImage(n,o.source,c)}}class Sp{constructor(n){this.parser=n,this.name=ye.EXT_TEXTURE_AVIF}loadTexture(n){const t=this.name,i=this.parser,r=i.json,a=r.textures[n];if(!a.extensions||!a.extensions[t])return null;const o=a.extensions[t],s=r.images[o.source];let c=i.textureLoader;if(s.uri){const d=i.options.manager.getHandler(s.uri);d!==null&&(c=d)}return i.loadTextureImage(n,o.source,c)}}class aa{constructor(n,t){this.name=t,this.parser=n}loadBufferView(n){const t=this.parser.json,i=t.bufferViews[n];if(i.extensions&&i.extensions[this.name]){const r=i.extensions[this.name],a=this.parser.getDependency("buffer",r.buffer),o=this.parser.options.meshoptDecoder;if(!o||!o.supported){if(t.extensionsRequired&&t.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files");return null}return a.then(function(s){const c=r.byteOffset||0,d=r.byteLength||0,g=r.count,_=r.byteStride,p=new Uint8Array(s,c,d);return o.decodeGltfBufferAsync?o.decodeGltfBufferAsync(g,_,p,r.mode,r.filter).then(function(v){return v.buffer}):o.ready.then(function(){const v=new ArrayBuffer(g*_);return o.decodeGltfBuffer(new Uint8Array(v),g,_,p,r.mode,r.filter),v})})}else return null}}class xp{constructor(n){this.name=ye.EXT_MESH_GPU_INSTANCING,this.parser=n}createNodeMesh(n){const t=this.parser.json,i=t.nodes[n];if(!i.extensions||!i.extensions[this.name]||i.mesh===void 0)return null;const r=t.meshes[i.mesh];for(const d of r.primitives)if(d.mode!==Ct.TRIANGLES&&d.mode!==Ct.TRIANGLE_STRIP&&d.mode!==Ct.TRIANGLE_FAN&&d.mode!==void 0)return null;const o=i.extensions[this.name].attributes,s=[],c={};for(const d in o)s.push(this.parser.getDependency("accessor",o[d]).then(g=>(c[d]=g,c[d])));return s.length<1?null:(s.push(this.parser.createNodeMesh(n)),Promise.all(s).then(d=>{const g=d.pop(),_=g.isGroup?g.children:[g],p=d[0].count,v=[];for(const R of _){const E=new Et,u=new me,f=new tn,b=new me(1,1,1),D=new Na(R.geometry,R.material,p);for(let A=0;A<p;A++)c.TRANSLATION&&u.fromBufferAttribute(c.TRANSLATION,A),c.ROTATION&&f.fromBufferAttribute(c.ROTATION,A),c.SCALE&&b.fromBufferAttribute(c.SCALE,A),D.setMatrixAt(A,E.compose(u,f,b));let S=null;for(const A in c)if(A==="_COLOR_0"){const M=c[A];D.instanceColor=new Dr(M.array,M.itemSize,M.normalized)}else if(A!=="TRANSLATION"&&A!=="ROTATION"&&A!=="SCALE"){if(S===null){const C=D.geometry;S=new Tn,S.name=C.name;for(const m in C.attributes)S.setAttribute(m,C.attributes[m]);for(const m in C.morphAttributes)S.morphAttributes[m]=C.morphAttributes[m];C.index!==null&&S.setIndex(C.index),S.morphTargetsRelative=C.morphTargetsRelative;for(const m of C.groups)S.addGroup(m.start,m.count,m.materialIndex);C.boundingBox!==null&&(S.boundingBox=C.boundingBox.clone()),C.boundingSphere!==null&&(S.boundingSphere=C.boundingSphere.clone()),S.drawRange.start=C.drawRange.start,S.drawRange.count=C.drawRange.count,S.userData=Object.assign({},C.userData),D.geometry=S}const M=c[A];S.setAttribute(A,new Dr(M.array,M.itemSize,M.normalized))}yi.prototype.copy.call(D,R),this.parser.assignFinalMaterial(D),v.push(D)}return g.isGroup?(g.clear(),g.add(...v),g):v[0]}))}}const Za="glTF",Ln=12,oa={JSON:1313821514,BIN:5130562};class Ep{constructor(n){this.name=ye.KHR_BINARY_GLTF,this.content=null,this.body=null;const t=new DataView(n,0,Ln),i=new TextDecoder;if(this.header={magic:i.decode(new Uint8Array(n.slice(0,4))),version:t.getUint32(4,!0),length:t.getUint32(8,!0)},this.header.magic!==Za)throw new Error("THREE.GLTFLoader: Unsupported glTF-Binary header.");if(this.header.version<2)throw new Error("THREE.GLTFLoader: Legacy binary file detected.");const r=this.header.length-Ln,a=new DataView(n,Ln);let o=0;for(;o<r;){const s=a.getUint32(o,!0);o+=4;const c=a.getUint32(o,!0);if(o+=4,c===oa.JSON){const d=new Uint8Array(n,Ln+o,s);this.content=i.decode(d)}else if(c===oa.BIN){const d=Ln+o;this.body=n.slice(d,d+s)}o+=s}if(this.content===null)throw new Error("THREE.GLTFLoader: JSON content not found.")}}class Mp{constructor(n,t){if(!t)throw new Error("THREE.GLTFLoader: No DRACOLoader instance provided.");this.name=ye.KHR_DRACO_MESH_COMPRESSION,this.json=n,this.dracoLoader=t,this.dracoLoader.preload()}decodePrimitive(n,t){const i=this.json,r=this.dracoLoader,a=n.extensions[this.name].bufferView,o=n.extensions[this.name].attributes,s={},c={},d={};for(const g in o){const _=Ci[g]||g.toLowerCase();s[_]=o[g]}for(const g in n.attributes){const _=Ci[g]||g.toLowerCase();if(o[g]!==void 0){const p=i.accessors[n.attributes[g]],v=gn[p.componentType];d[_]=v.name,c[_]=p.normalized===!0}}return t.getDependency("bufferView",a).then(function(g){return new Promise(function(_,p){r.decodeDracoFile(g,function(v){for(const R in v.attributes){const E=v.attributes[R],u=c[R];u!==void 0&&(E.normalized=u)}_(v)},s,d,Dt,p)})})}}class Tp{constructor(){this.name=ye.KHR_TEXTURE_TRANSFORM}extendTexture(n,t){if((t.texCoord===void 0||t.texCoord===n.channel)&&t.offset===void 0&&t.rotation===void 0&&t.scale===void 0)return n;if(n=n.clone(),t.texCoord!==void 0&&(n.channel=t.texCoord),t.offset!==void 0&&n.offset.fromArray(t.offset),t.rotation!==void 0&&(n.rotation=t.rotation),t.scale!==void 0&&n.repeat.fromArray(t.scale),t.rotation!==void 0){const i=Math.cos(n.rotation),r=Math.sin(n.rotation);n.matrix.set(n.repeat.x*i,n.repeat.y*r,n.offset.x,-n.repeat.x*r,n.repeat.y*i,n.offset.y,0,0,1),n.matrixAutoUpdate=!1}return n.needsUpdate=!0,n}}class Ap{constructor(){this.name=ye.KHR_MESH_QUANTIZATION}}class $a extends Hs{constructor(n,t,i,r){super(n,t,i,r)}copySampleValue_(n){const t=this.resultBuffer,i=this.sampleValues,r=this.valueSize,a=n*r*3+r;for(let o=0;o!==r;o++)t[o]=i[a+o];return t}interpolate_(n,t,i,r){const a=this.resultBuffer,o=this.sampleValues,s=this.valueSize,c=s*2,d=s*3,g=r-t,_=(i-t)/g,p=_*_,v=p*_,R=n*d,E=R-d,u=-2*v+3*p,f=v-p,b=1-u,D=f-p+_;for(let S=0;S!==s;S++){const A=o[E+S+s],M=o[E+S+c]*g,C=o[R+S+s],m=o[R+S]*g;a[S]=b*A+D*M+u*C+f*m}return a}}const Rp=new tn;class bp extends $a{interpolate_(n,t,i,r){const a=super.interpolate_(n,t,i,r);return Rp.fromArray(a).normalize().toArray(a),a}}const Ct={POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6},gn={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},sa={9728:Vt,9729:vt,9984:ua,9985:Vn,9986:Dn,9987:$t},ca={33071:Kn,33648:da,10497:qn},_i={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16},Ci={POSITION:"position",NORMAL:"normal",TANGENT:"tangent",TEXCOORD_0:"uv",TEXCOORD_1:"uv1",TEXCOORD_2:"uv2",TEXCOORD_3:"uv3",COLOR_0:"color",WEIGHTS_0:"skinWeight",JOINTS_0:"skinIndex"},Zt={scale:"scale",translation:"position",rotation:"quaternion",weights:"morphTargetInfluences"},Cp={CUBICSPLINE:void 0,LINEAR:Fa,STEP:Bs},gi={OPAQUE:"OPAQUE",MASK:"MASK",BLEND:"BLEND"};function wp(e){return e.DefaultMaterial===void 0&&(e.DefaultMaterial=new Mn({color:16777215,emissive:0,metalness:1,roughness:1,transparent:!1,depthTest:!0,side:vn})),e.DefaultMaterial}function en(e,n,t){for(const i in t.extensions)e[i]===void 0&&(n.userData.gltfExtensions=n.userData.gltfExtensions||{},n.userData.gltfExtensions[i]=t.extensions[i])}function Nt(e,n){n.extras!==void 0&&(typeof n.extras=="object"?Object.assign(e.userData,n.extras):console.warn("THREE.GLTFLoader: Ignoring primitive type .extras, "+n.extras))}function Pp(e,n,t){let i=!1,r=!1,a=!1;for(let d=0,g=n.length;d<g;d++){const _=n[d];if(_.POSITION!==void 0&&(i=!0),_.NORMAL!==void 0&&(r=!0),_.COLOR_0!==void 0&&(a=!0),i&&r&&a)break}if(!i&&!r&&!a)return Promise.resolve(e);const o=[],s=[],c=[];for(let d=0,g=n.length;d<g;d++){const _=n[d];if(i){const p=_.POSITION!==void 0?t.getDependency("accessor",_.POSITION):e.attributes.position;o.push(p)}if(r){const p=_.NORMAL!==void 0?t.getDependency("accessor",_.NORMAL):e.attributes.normal;s.push(p)}if(a){const p=_.COLOR_0!==void 0?t.getDependency("accessor",_.COLOR_0):e.attributes.color;c.push(p)}}return Promise.all([Promise.all(o),Promise.all(s),Promise.all(c)]).then(function(d){const g=d[0],_=d[1],p=d[2];return i&&(e.morphAttributes.position=g),r&&(e.morphAttributes.normal=_),a&&(e.morphAttributes.color=p),e.morphTargetsRelative=!0,e})}function Lp(e,n){if(e.updateMorphTargets(),n.weights!==void 0)for(let t=0,i=n.weights.length;t<i;t++)e.morphTargetInfluences[t]=n.weights[t];if(n.extras&&Array.isArray(n.extras.targetNames)){const t=n.extras.targetNames;if(e.morphTargetInfluences.length===t.length){e.morphTargetDictionary={};for(let i=0,r=t.length;i<r;i++)e.morphTargetDictionary[t[i]]=i}else console.warn("THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.")}}function Dp(e){let n;const t=e.extensions&&e.extensions[ye.KHR_DRACO_MESH_COMPRESSION];if(t?n="draco:"+t.bufferView+":"+t.indices+":"+vi(t.attributes):n=e.indices+":"+vi(e.attributes)+":"+e.mode,e.targets!==void 0)for(let i=0,r=e.targets.length;i<r;i++)n+=":"+vi(e.targets[i]);return n}function vi(e){let n="";const t=Object.keys(e).sort();for(let i=0,r=t.length;i<r;i++)n+=t[i]+":"+e[t[i]]+";";return n}function wi(e){switch(e){case Int8Array:return 1/127;case Uint8Array:return 1/255;case Int16Array:return 1/32767;case Uint16Array:return 1/65535;default:throw new Error("THREE.GLTFLoader: Unsupported normalized accessor component type.")}}function Up(e){return e.search(/\.jpe?g($|\?)/i)>0||e.search(/^data\:image\/jpeg/)===0?"image/jpeg":e.search(/\.webp($|\?)/i)>0||e.search(/^data\:image\/webp/)===0?"image/webp":e.search(/\.ktx2($|\?)/i)>0||e.search(/^data\:image\/ktx2/)===0?"image/ktx2":"image/png"}const yp=new Et;class Ip{constructor(n={},t={}){this.json=n,this.extensions={},this.plugins={},this.options=t,this.cache=new ip,this.associations=new Map,this.primitiveCache={},this.nodeCache={},this.meshCache={refs:{},uses:{}},this.cameraCache={refs:{},uses:{}},this.lightCache={refs:{},uses:{}},this.sourceCache={},this.textureCache={},this.nodeNamesUsed={};let i=!1,r=-1,a=!1,o=-1;if(typeof navigator<"u"&&typeof navigator.userAgent<"u"){const s=navigator.userAgent;i=/^((?!chrome|android).)*safari/i.test(s)===!0;const c=s.match(/Version\/(\d+)/);r=i&&c?parseInt(c[1],10):-1,a=s.indexOf("Firefox")>-1,o=a?s.match(/Firefox\/([0-9]+)\./)[1]:-1}typeof createImageBitmap>"u"||i&&r<17||a&&o<98?this.textureLoader=new As(this.options.manager):this.textureLoader=new Rs(this.options.manager),this.textureLoader.setCrossOrigin(this.options.crossOrigin),this.textureLoader.setRequestHeader(this.options.requestHeader),this.fileLoader=new Ua(this.options.manager),this.fileLoader.setResponseType("arraybuffer"),this.options.crossOrigin==="use-credentials"&&this.fileLoader.setWithCredentials(!0)}setExtensions(n){this.extensions=n}setPlugins(n){this.plugins=n}parse(n,t){const i=this,r=this.json,a=this.extensions;this.cache.removeAll(),this.nodeCache={},this._invokeAll(function(o){return o._markDefs&&o._markDefs()}),Promise.all(this._invokeAll(function(o){return o.beforeRoot&&o.beforeRoot()})).then(function(){return Promise.all([i.getDependencies("scene"),i.getDependencies("animation"),i.getDependencies("camera")])}).then(function(o){const s={scene:o[0][r.scene||0],scenes:o[0],animations:o[1],cameras:o[2],asset:r.asset,parser:i,userData:{}};return en(a,s,r),Nt(s,r),Promise.all(i._invokeAll(function(c){return c.afterRoot&&c.afterRoot(s)})).then(function(){for(const c of s.scenes)c.updateMatrixWorld();n(s)})}).catch(t)}_markDefs(){const n=this.json.nodes||[],t=this.json.skins||[],i=this.json.meshes||[];for(let r=0,a=t.length;r<a;r++){const o=t[r].joints;for(let s=0,c=o.length;s<c;s++)n[o[s]].isBone=!0}for(let r=0,a=n.length;r<a;r++){const o=n[r];o.mesh!==void 0&&(this._addNodeRef(this.meshCache,o.mesh),o.skin!==void 0&&(i[o.mesh].isSkinnedMesh=!0)),o.camera!==void 0&&this._addNodeRef(this.cameraCache,o.camera)}}_addNodeRef(n,t){t!==void 0&&(n.refs[t]===void 0&&(n.refs[t]=n.uses[t]=0),n.refs[t]++)}_getNodeRef(n,t,i){if(n.refs[t]<=1)return i;const r=i.clone(),a=(o,s)=>{const c=this.associations.get(o);c!=null&&this.associations.set(s,c);for(const[d,g]of o.children.entries())a(g,s.children[d])};return a(i,r),r.name+="_instance_"+n.uses[t]++,r}_invokeOne(n){const t=Object.values(this.plugins);t.push(this);for(let i=0;i<t.length;i++){const r=n(t[i]);if(r)return r}return null}_invokeAll(n){const t=Object.values(this.plugins);t.unshift(this);const i=[];for(let r=0;r<t.length;r++){const a=n(t[r]);a&&i.push(a)}return i}getDependency(n,t){const i=n+":"+t;let r=this.cache.get(i);if(!r){switch(n){case"scene":r=this.loadScene(t);break;case"node":r=this._invokeOne(function(a){return a.loadNode&&a.loadNode(t)});break;case"mesh":r=this._invokeOne(function(a){return a.loadMesh&&a.loadMesh(t)});break;case"accessor":r=this.loadAccessor(t);break;case"bufferView":r=this._invokeOne(function(a){return a.loadBufferView&&a.loadBufferView(t)});break;case"buffer":r=this.loadBuffer(t);break;case"material":r=this._invokeOne(function(a){return a.loadMaterial&&a.loadMaterial(t)});break;case"texture":r=this._invokeOne(function(a){return a.loadTexture&&a.loadTexture(t)});break;case"skin":r=this.loadSkin(t);break;case"animation":r=this._invokeOne(function(a){return a.loadAnimation&&a.loadAnimation(t)});break;case"camera":r=this.loadCamera(t);break;default:if(r=this._invokeOne(function(a){return a!=this&&a.getDependency&&a.getDependency(n,t)}),!r)throw new Error("Unknown type: "+n);break}this.cache.add(i,r)}return r}getDependencies(n){let t=this.cache.get(n);if(!t){const i=this,r=this.json[n+(n==="mesh"?"es":"s")]||[];t=Promise.all(r.map(function(a,o){return i.getDependency(n,o)})),this.cache.add(n,t)}return t}loadBuffer(n){const t=this.json.buffers[n],i=this.fileLoader;if(t.type&&t.type!=="arraybuffer")throw new Error("THREE.GLTFLoader: "+t.type+" buffer type is not supported.");if(t.uri===void 0&&n===0)return Promise.resolve(this.extensions[ye.KHR_BINARY_GLTF].body);const r=this.options;return new Promise(function(a,o){i.load(In.resolveURL(t.uri,r.path),a,void 0,function(){o(new Error('THREE.GLTFLoader: Failed to load buffer "'+t.uri+'".'))})})}loadBufferView(n){const t=this.json.bufferViews[n];return this.getDependency("buffer",t.buffer).then(function(i){const r=t.byteLength||0,a=t.byteOffset||0;return i.slice(a,a+r)})}loadAccessor(n){const t=this,i=this.json,r=this.json.accessors[n];if(r.bufferView===void 0&&r.sparse===void 0){const o=_i[r.type],s=gn[r.componentType],c=r.normalized===!0,d=new s(r.count*o);return Promise.resolve(new nn(d,o,c))}const a=[];return r.bufferView!==void 0?a.push(this.getDependency("bufferView",r.bufferView)):a.push(null),r.sparse!==void 0&&(a.push(this.getDependency("bufferView",r.sparse.indices.bufferView)),a.push(this.getDependency("bufferView",r.sparse.values.bufferView))),Promise.all(a).then(function(o){const s=o[0],c=_i[r.type],d=gn[r.componentType],g=d.BYTES_PER_ELEMENT,_=g*c,p=r.byteOffset||0,v=r.bufferView!==void 0?i.bufferViews[r.bufferView].byteStride:void 0,R=r.normalized===!0;let E,u;if(v&&v!==_){const f=Math.floor(p/v),b="InterleavedBuffer:"+r.bufferView+":"+r.componentType+":"+f+":"+r.count;let D=t.cache.get(b);D||(E=new d(s,f*v,r.count*v/g),D=new bs(E,v/g),t.cache.add(b,D)),u=new Gs(D,c,p%v/g,R)}else s===null?E=new d(r.count*c):E=new d(s,p,r.count*c),u=new nn(E,c,R);if(r.sparse!==void 0){const f=_i.SCALAR,b=gn[r.sparse.indices.componentType],D=r.sparse.indices.byteOffset||0,S=r.sparse.values.byteOffset||0,A=new b(o[1],D,r.sparse.count*f),M=new d(o[2],S,r.sparse.count*c);s!==null&&(u=new nn(u.array.slice(),u.itemSize,u.normalized)),u.normalized=!1;for(let C=0,m=A.length;C<m;C++){const T=A[C];if(u.setX(T,M[C*c]),c>=2&&u.setY(T,M[C*c+1]),c>=3&&u.setZ(T,M[C*c+2]),c>=4&&u.setW(T,M[C*c+3]),c>=5)throw new Error("THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.")}u.normalized=R}return u})}loadTexture(n){const t=this.json,i=this.options,a=t.textures[n].source,o=t.images[a];let s=this.textureLoader;if(o.uri){const c=i.manager.getHandler(o.uri);c!==null&&(s=c)}return this.loadTextureImage(n,a,s)}loadTextureImage(n,t,i){const r=this,a=this.json,o=a.textures[n],s=a.images[t],c=(s.uri||s.bufferView)+":"+o.sampler;if(this.textureCache[c])return this.textureCache[c];const d=this.loadImageSource(t,i).then(function(g){g.flipY=!1,g.name=o.name||s.name||"",g.name===""&&typeof s.uri=="string"&&s.uri.startsWith("data:image/")===!1&&(g.name=s.uri);const p=(a.samplers||{})[o.sampler]||{};return g.magFilter=sa[p.magFilter]||vt,g.minFilter=sa[p.minFilter]||$t,g.wrapS=ca[p.wrapS]||qn,g.wrapT=ca[p.wrapT]||qn,g.generateMipmaps=!g.isCompressedTexture&&g.minFilter!==Vt&&g.minFilter!==vt,r.associations.set(g,{textures:n}),g}).catch(function(){return null});return this.textureCache[c]=d,d}loadImageSource(n,t){const i=this,r=this.json,a=this.options;if(this.sourceCache[n]!==void 0)return this.sourceCache[n].then(_=>_.clone());const o=r.images[n],s=self.URL||self.webkitURL;let c=o.uri||"",d=!1;if(o.bufferView!==void 0)c=i.getDependency("bufferView",o.bufferView).then(function(_){d=!0;const p=new Blob([_],{type:o.mimeType});return c=s.createObjectURL(p),c});else if(o.uri===void 0)throw new Error("THREE.GLTFLoader: Image "+n+" is missing URI and bufferView");const g=Promise.resolve(c).then(function(_){return new Promise(function(p,v){let R=p;t.isImageBitmapLoader===!0&&(R=function(E){const u=new Mi(E);u.needsUpdate=!0,p(u)}),t.load(In.resolveURL(_,a.path),R,void 0,v)})}).then(function(_){return d===!0&&s.revokeObjectURL(c),Nt(_,o),_.userData.mimeType=o.mimeType||Up(o.uri),_}).catch(function(_){throw console.error("THREE.GLTFLoader: Couldn't load texture",c),_});return this.sourceCache[n]=g,g}assignTexture(n,t,i,r){const a=this;return this.getDependency("texture",i.index).then(function(o){if(!o)return null;if(i.texCoord!==void 0&&i.texCoord>0&&(o=o.clone(),o.channel=i.texCoord),a.extensions[ye.KHR_TEXTURE_TRANSFORM]){const s=i.extensions!==void 0?i.extensions[ye.KHR_TEXTURE_TRANSFORM]:void 0;if(s){const c=a.associations.get(o);o=a.extensions[ye.KHR_TEXTURE_TRANSFORM].extendTexture(o,s),a.associations.set(o,c)}}return r!==void 0&&(o.colorSpace=r),n[t]=o,o})}assignFinalMaterial(n){const t=n.geometry;let i=n.material;const r=t.attributes.tangent===void 0,a=t.attributes.color!==void 0,o=t.attributes.normal===void 0;if(n.isPoints){const s="PointsMaterial:"+i.uuid;let c=this.cache.get(s);c||(c=new Cs,li.prototype.copy.call(c,i),c.color.copy(i.color),c.map=i.map,c.sizeAttenuation=!1,this.cache.add(s,c)),i=c}else if(n.isLine){const s="LineBasicMaterial:"+i.uuid;let c=this.cache.get(s);c||(c=new ws,li.prototype.copy.call(c,i),c.color.copy(i.color),c.map=i.map,this.cache.add(s,c)),i=c}if(r||a||o){let s="ClonedMaterial:"+i.uuid+":";r&&(s+="derivative-tangents:"),a&&(s+="vertex-colors:"),o&&(s+="flat-shading:");let c=this.cache.get(s);c||(c=i.clone(),a&&(c.vertexColors=!0),o&&(c.flatShading=!0),r&&(c.normalScale&&(c.normalScale.y*=-1),c.clearcoatNormalScale&&(c.clearcoatNormalScale.y*=-1)),this.cache.add(s,c),this.associations.set(c,this.associations.get(i))),i=c}n.material=i}getMaterialType(){return Mn}loadMaterial(n){const t=this,i=this.json,r=this.extensions,a=i.materials[n];let o;const s={},c=a.extensions||{},d=[];if(c[ye.KHR_MATERIALS_UNLIT]){const _=r[ye.KHR_MATERIALS_UNLIT];o=_.getMaterialType(),d.push(_.extendParams(s,a,t))}else{const _=a.pbrMetallicRoughness||{};if(s.color=new Ve(1,1,1),s.opacity=1,Array.isArray(_.baseColorFactor)){const p=_.baseColorFactor;s.color.setRGB(p[0],p[1],p[2],Dt),s.opacity=p[3]}_.baseColorTexture!==void 0&&d.push(t.assignTexture(s,"map",_.baseColorTexture,Pt)),s.metalness=_.metallicFactor!==void 0?_.metallicFactor:1,s.roughness=_.roughnessFactor!==void 0?_.roughnessFactor:1,_.metallicRoughnessTexture!==void 0&&(d.push(t.assignTexture(s,"metalnessMap",_.metallicRoughnessTexture)),d.push(t.assignTexture(s,"roughnessMap",_.metallicRoughnessTexture))),o=this._invokeOne(function(p){return p.getMaterialType&&p.getMaterialType(n)}),d.push(Promise.all(this._invokeAll(function(p){return p.extendMaterialParams&&p.extendMaterialParams(n,s)})))}a.doubleSided===!0&&(s.side=Bt);const g=a.alphaMode||gi.OPAQUE;if(g===gi.BLEND?(s.transparent=!0,s.depthWrite=!1):(s.transparent=!1,g===gi.MASK&&(s.alphaTest=a.alphaCutoff!==void 0?a.alphaCutoff:.5)),a.normalTexture!==void 0&&o!==un&&(d.push(t.assignTexture(s,"normalMap",a.normalTexture)),s.normalScale=new mt(1,1),a.normalTexture.scale!==void 0)){const _=a.normalTexture.scale;s.normalScale.set(_,_)}if(a.occlusionTexture!==void 0&&o!==un&&(d.push(t.assignTexture(s,"aoMap",a.occlusionTexture)),a.occlusionTexture.strength!==void 0&&(s.aoMapIntensity=a.occlusionTexture.strength)),a.emissiveFactor!==void 0&&o!==un){const _=a.emissiveFactor;s.emissive=new Ve().setRGB(_[0],_[1],_[2],Dt)}return a.emissiveTexture!==void 0&&o!==un&&d.push(t.assignTexture(s,"emissiveMap",a.emissiveTexture,Pt)),Promise.all(d).then(function(){const _=new o(s);return a.name&&(_.name=a.name),Nt(_,a),t.associations.set(_,{materials:n}),a.extensions&&en(r,_,a),_})}createUniqueName(n){const t=Ps.sanitizeNodeName(n||"");return t in this.nodeNamesUsed?t+"_"+ ++this.nodeNamesUsed[t]:(this.nodeNamesUsed[t]=0,t)}loadGeometries(n){const t=this,i=this.extensions,r=this.primitiveCache;function a(s){return i[ye.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(s,t).then(function(c){return la(c,s,t)})}const o=[];for(let s=0,c=n.length;s<c;s++){const d=n[s],g=Dp(d),_=r[g];if(_)o.push(_.promise);else{let p;d.extensions&&d.extensions[ye.KHR_DRACO_MESH_COMPRESSION]?p=a(d):p=la(new Tn,d,t),d.mode===Ct.TRIANGLE_STRIP?p=p.then(v=>ra(v,Da)):d.mode===Ct.TRIANGLE_FAN&&(p=p.then(v=>ra(v,Ti))),r[g]={primitive:d,promise:p},o.push(p)}}return Promise.all(o)}loadMesh(n){const t=this,i=this.json,r=this.extensions,a=i.meshes[n],o=a.primitives,s=[];for(let c=0,d=o.length;c<d;c++){const g=o[c].material===void 0?wp(this.cache):this.getDependency("material",o[c].material);s.push(g)}return s.push(t.loadGeometries(o)),Promise.all(s).then(async function(c){const d=c.slice(0,c.length-1),g=c[c.length-1],_=[];for(let v=0,R=g.length;v<R;v++){const E=g[v],u=o[v];let f;const b=d[v];if(u.mode===Ct.TRIANGLES||u.mode===Ct.TRIANGLE_STRIP||u.mode===Ct.TRIANGLE_FAN||u.mode===void 0){const D=a.isSkinnedMesh===!0,S=E.hasAttribute("skinIndex")&&E.hasAttribute("skinWeight");D&&S===!1&&console.warn("THREE.GLTFLoader: Missing skinIndex or skinWeight attributes. Skinning disabled."),f=D&&S?new Ls(E,b):new et(E,b),f.isSkinnedMesh===!0&&f.normalizeSkinWeights()}else if(u.mode===Ct.LINES)f=new Ds(E,b);else if(u.mode===Ct.LINE_STRIP)f=new Us(E,b);else if(u.mode===Ct.LINE_LOOP)f=new ys(E,b);else if(u.mode===Ct.POINTS)f=new Is(E,b);else throw new Error("THREE.GLTFLoader: Primitive mode unsupported: "+u.mode);Object.keys(f.geometry.morphAttributes).length>0&&Lp(f,a),f.name=t.createUniqueName(a.name||"mesh_"+n),Nt(f,a),u.extensions&&en(r,f,u),t.assignFinalMaterial(f),_.push(f)}for(let v=0,R=_.length;v<R;v++)t.associations.set(_[v],{meshes:n,primitives:v});if(_.length===1)return a.extensions&&en(r,_[0],a),_[0];const p=new rn;a.extensions&&en(r,p,a),t.associations.set(p,{meshes:n});for(let v=0,R=_.length;v<R;v++)p.add(_[v]);return p})}loadCamera(n){let t;const i=this.json.cameras[n],r=i[i.type];if(!r){console.warn("THREE.GLTFLoader: Missing camera parameters.");return}return i.type==="perspective"?t=new mn(_n.radToDeg(r.yfov),r.aspectRatio||1,r.znear||1,r.zfar||2e6):i.type==="orthographic"&&(t=new Pi(-r.xmag,r.xmag,r.ymag,-r.ymag,r.znear,r.zfar)),i.name&&(t.name=this.createUniqueName(i.name)),Nt(t,i),Promise.resolve(t)}loadSkin(n){const t=this.json.skins[n],i=[];for(let r=0,a=t.joints.length;r<a;r++)i.push(this._loadNodeShallow(t.joints[r]));return t.inverseBindMatrices!==void 0?i.push(this.getDependency("accessor",t.inverseBindMatrices)):i.push(null),Promise.all(i).then(function(r){const a=r.pop(),o=r,s=[],c=[];for(let d=0,g=o.length;d<g;d++){const _=o[d];if(_){s.push(_);const p=new Et;a!==null&&p.fromArray(a.array,d*16),c.push(p)}else console.warn('THREE.GLTFLoader: Joint "%s" could not be found.',t.joints[d])}return new Ns(s,c)})}loadAnimation(n){const t=this.json,i=this,r=t.animations[n],a=r.name?r.name:"animation_"+n,o=[],s=[],c=[],d=[],g=[];for(let _=0,p=r.channels.length;_<p;_++){const v=r.channels[_],R=r.samplers[v.sampler],E=v.target,u=E.node,f=r.parameters!==void 0?r.parameters[R.input]:R.input,b=r.parameters!==void 0?r.parameters[R.output]:R.output;E.node!==void 0&&(o.push(this.getDependency("node",u)),s.push(this.getDependency("accessor",f)),c.push(this.getDependency("accessor",b)),d.push(R),g.push(E))}return Promise.all([Promise.all(o),Promise.all(s),Promise.all(c),Promise.all(d),Promise.all(g)]).then(function(_){const p=_[0],v=_[1],R=_[2],E=_[3],u=_[4],f=[];for(let D=0,S=p.length;D<S;D++){const A=p[D],M=v[D],C=R[D],m=E[D],T=u[D];if(A===void 0)continue;A.updateMatrix&&A.updateMatrix();const U=i._createAnimationTracks(A,M,C,m,T);if(U)for(let N=0;N<U.length;N++)f.push(U[N])}const b=new Fs(a,void 0,f);return Nt(b,r),b})}createNodeMesh(n){const t=this.json,i=this,r=t.nodes[n];return r.mesh===void 0?null:i.getDependency("mesh",r.mesh).then(function(a){const o=i._getNodeRef(i.meshCache,r.mesh,a);return r.weights!==void 0&&o.traverse(function(s){if(s.isMesh)for(let c=0,d=r.weights.length;c<d;c++)s.morphTargetInfluences[c]=r.weights[c]}),o})}loadNode(n){const t=this.json,i=this,r=t.nodes[n],a=i._loadNodeShallow(n),o=[],s=r.children||[];for(let d=0,g=s.length;d<g;d++)o.push(i.getDependency("node",s[d]));const c=r.skin===void 0?Promise.resolve(null):i.getDependency("skin",r.skin);return Promise.all([a,Promise.all(o),c]).then(function(d){const g=d[0],_=d[1],p=d[2];p!==null&&g.traverse(function(v){v.isSkinnedMesh&&v.bind(p,yp)});for(let v=0,R=_.length;v<R;v++)g.add(_[v]);if(g.userData.pivot!==void 0&&_.length>0){const v=g.userData.pivot,R=_[0];g.pivot=new me().fromArray(v),g.position.x-=v[0],g.position.y-=v[1],g.position.z-=v[2],R.position.set(0,0,0),delete g.userData.pivot}return g})}_loadNodeShallow(n){const t=this.json,i=this.extensions,r=this;if(this.nodeCache[n]!==void 0)return this.nodeCache[n];const a=t.nodes[n],o=a.name?r.createUniqueName(a.name):"",s=[],c=r._invokeOne(function(d){return d.createNodeMesh&&d.createNodeMesh(n)});return c&&s.push(c),a.camera!==void 0&&s.push(r.getDependency("camera",a.camera).then(function(d){return r._getNodeRef(r.cameraCache,a.camera,d)})),r._invokeAll(function(d){return d.createNodeAttachment&&d.createNodeAttachment(n)}).forEach(function(d){s.push(d)}),this.nodeCache[n]=Promise.all(s).then(function(d){let g;if(a.isBone===!0?g=new Os:d.length>1?g=new rn:d.length===1?g=d[0]:g=new yi,g!==d[0])for(let _=0,p=d.length;_<p;_++)g.add(d[_]);if(a.name&&(g.userData.name=a.name,g.name=o),Nt(g,a),a.extensions&&en(i,g,a),a.matrix!==void 0){const _=new Et;_.fromArray(a.matrix),g.applyMatrix4(_)}else a.translation!==void 0&&g.position.fromArray(a.translation),a.rotation!==void 0&&g.quaternion.fromArray(a.rotation),a.scale!==void 0&&g.scale.fromArray(a.scale);if(!r.associations.has(g))r.associations.set(g,{});else if(a.mesh!==void 0&&r.meshCache.refs[a.mesh]>1){const _=r.associations.get(g);r.associations.set(g,{..._})}return r.associations.get(g).nodes=n,g}),this.nodeCache[n]}loadScene(n){const t=this.extensions,i=this.json.scenes[n],r=this,a=new rn;i.name&&(a.name=r.createUniqueName(i.name)),Nt(a,i),i.extensions&&en(t,a,i);const o=i.nodes||[],s=[];for(let c=0,d=o.length;c<d;c++)s.push(r.getDependency("node",o[c]));return Promise.all(s).then(function(c){for(let g=0,_=c.length;g<_;g++){const p=c[g];p.parent!==null?a.add(tp(p)):a.add(p)}const d=g=>{const _=new Map;for(const[p,v]of r.associations)(p instanceof li||p instanceof Mi)&&_.set(p,v);return g.traverse(p=>{const v=r.associations.get(p);v!=null&&_.set(p,v)}),_};return r.associations=d(a),a})}_createAnimationTracks(n,t,i,r,a){const o=[],s=n.name?n.name:n.uuid,c=[];function d(v){v.morphTargetInfluences&&c.push(v.name?v.name:v.uuid)}Zt[a.path]===Zt.weights?(d(n),n.isGroup&&n.children.forEach(d)):c.push(s);let g;switch(Zt[a.path]){case Zt.weights:g=yr;break;case Zt.rotation:g=Ir;break;case Zt.translation:case Zt.scale:g=Ur;break;default:switch(i.itemSize){case 1:g=yr;break;case 2:case 3:default:g=Ur;break}break}const _=r.interpolation!==void 0?Cp[r.interpolation]:Fa,p=this._getArrayFromAccessor(i);for(let v=0,R=c.length;v<R;v++){const E=new g(c[v]+"."+Zt[a.path],t.array,p,_);r.interpolation==="CUBICSPLINE"&&this._createCubicSplineTrackInterpolant(E),o.push(E)}return o}_getArrayFromAccessor(n){let t=n.array;if(n.normalized){const i=wi(t.constructor),r=new Float32Array(t.length);for(let a=0,o=t.length;a<o;a++)r[a]=t[a]*i;t=r}return t}_createCubicSplineTrackInterpolant(n){n.createInterpolant=function(i){const r=this instanceof Ir?bp:$a;return new r(this.times,this.values,this.getValueSize()/3,i)},n.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline=!0}}function Np(e,n,t){const i=n.attributes,r=new an;if(i.POSITION!==void 0){const s=t.json.accessors[i.POSITION],c=s.min,d=s.max;if(c!==void 0&&d!==void 0){if(r.set(new me(c[0],c[1],c[2]),new me(d[0],d[1],d[2])),s.normalized){const g=wi(gn[s.componentType]);r.min.multiplyScalar(g),r.max.multiplyScalar(g)}}else{console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");return}}else return;const a=n.targets;if(a!==void 0){const s=new me,c=new me;for(let d=0,g=a.length;d<g;d++){const _=a[d];if(_.POSITION!==void 0){const p=t.json.accessors[_.POSITION],v=p.min,R=p.max;if(v!==void 0&&R!==void 0){if(c.setX(Math.max(Math.abs(v[0]),Math.abs(R[0]))),c.setY(Math.max(Math.abs(v[1]),Math.abs(R[1]))),c.setZ(Math.max(Math.abs(v[2]),Math.abs(R[2]))),p.normalized){const E=wi(gn[p.componentType]);c.multiplyScalar(E)}s.max(c)}else console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.")}}r.expandByVector(s)}e.boundingBox=r;const o=new Vs;r.getCenter(o.center),o.radius=r.min.distanceTo(r.max)/2,e.boundingSphere=o}function la(e,n,t){const i=n.attributes,r=[];function a(o,s){return t.getDependency("accessor",o).then(function(c){e.setAttribute(s,c)})}for(const o in i){const s=Ci[o]||o.toLowerCase();s in e.attributes||r.push(a(i[o],s))}if(n.indices!==void 0&&!e.index){const o=t.getDependency("accessor",n.indices).then(function(s){e.setIndex(s)});r.push(o)}return it.workingColorSpace!==Dt&&"COLOR_0"in i&&console.warn(`THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "${it.workingColorSpace}" not supported.`),Nt(e,n),Np(e,n,t),Promise.all(r).then(function(){return n.targets!==void 0?Pp(e,n.targets,t):e})}class Fp extends Oa{constructor(){super(),this.name="RoomEnvironment",this.position.y=-3.5;const n=new $n;n.deleteAttribute("uv");const t=new Mn({side:At}),i=new Mn,r=new ya(16777215,900,28,2);r.position.set(.418,16.199,.3),this.add(r);const a=new et(n,t);a.position.set(-.757,13.219,.717),a.scale.set(31.713,28.305,28.591),this.add(a);const o=new Na(n,i,6),s=new yi;s.position.set(-10.906,2.009,1.846),s.rotation.set(0,-.195,0),s.scale.set(2.328,7.905,4.651),s.updateMatrix(),o.setMatrixAt(0,s.matrix),s.position.set(-5.607,-.754,-.758),s.rotation.set(0,.994,0),s.scale.set(1.97,1.534,3.955),s.updateMatrix(),o.setMatrixAt(1,s.matrix),s.position.set(6.167,.857,7.803),s.rotation.set(0,.561,0),s.scale.set(3.927,6.285,3.687),s.updateMatrix(),o.setMatrixAt(2,s.matrix),s.position.set(-2.017,.018,6.124),s.rotation.set(0,.333,0),s.scale.set(2.002,4.566,2.064),s.updateMatrix(),o.setMatrixAt(3,s.matrix),s.position.set(2.291,-.756,-2.621),s.rotation.set(0,-.286,0),s.scale.set(1.546,1.552,1.496),s.updateMatrix(),o.setMatrixAt(4,s.matrix),s.position.set(-2.193,-.369,-5.547),s.rotation.set(0,.516,0),s.scale.set(3.875,3.487,2.986),s.updateMatrix(),o.setMatrixAt(5,s.matrix),this.add(o);const c=new et(n,fn(50));c.position.set(-16.116,14.37,8.208),c.scale.set(.1,2.428,2.739),this.add(c);const d=new et(n,fn(50));d.position.set(-16.109,18.021,-8.207),d.scale.set(.1,2.425,2.751),this.add(d);const g=new et(n,fn(17));g.position.set(14.904,12.198,-1.832),g.scale.set(.15,4.265,6.331),this.add(g);const _=new et(n,fn(43));_.position.set(-.462,8.89,14.52),_.scale.set(4.38,5.441,.088),this.add(_);const p=new et(n,fn(20));p.position.set(3.235,11.486,-12.541),p.scale.set(2.5,2,.1),this.add(p);const v=new et(n,fn(100));v.position.set(0,20,0),v.scale.set(1,.1,1),this.add(v)}dispose(){const n=new Set;this.traverse(t=>{t.isMesh&&(n.add(t.geometry),n.add(t.material))});for(const t of n)t.dispose()}}function fn(e){return new ks({color:0,emissive:16777215,emissiveIntensity:e})}function Op(e,n,t){e.onBeforeCompile=i=>{i.uniforms.spineWidth={value:n.ribWidth_mm},i.uniforms.spinePitch={value:n.ribPitch_mm},i.uniforms.spineStart={value:n.ribStart_mm},i.uniforms.spineEnd={value:n.ribEnd_mm},i.uniforms.spineSamplingScale={value:t},i.vertexShader=`varying vec2 vSpineRibUv;
`+i.vertexShader,i.vertexShader=i.vertexShader.replace("#include <uv_vertex>",`#include <uv_vertex>
vSpineRibUv = uv;`),i.fragmentShader=`
      varying vec2 vSpineRibUv;
      uniform float spineWidth;
      uniform float spinePitch;
      uniform float spineStart;
      uniform float spineEnd;
      uniform float spineSamplingScale;
    `+i.fragmentShader,i.fragmentShader=i.fragmentShader.replace("#include <normal_fragment_maps>",`
      #include <normal_fragment_maps>
      float ribPosition = vSpineRibUv.x * spineWidth;
      float ribPhase = (ribPosition - spineStart) / spinePitch;
      float ribFootprint = max(fwidth(ribPhase) * spineSamplingScale, 0.00001);
      // Suppress the relief smoothly before it exceeds the Nyquist frequency.
      float ribResolved = 1.0 - smoothstep(0.15, 0.45, ribFootprint);
      float ribEdge = max(fwidth(ribPosition) * spineSamplingScale, 0.00001);
      float ribMask = smoothstep(spineStart - ribEdge, spineStart + ribEdge, ribPosition)
        * (1.0 - smoothstep(spineEnd - ribEdge, spineEnd + ribEdge, ribPosition));
      vec3 ribDx = dFdx(-vViewPosition), ribDy = dFdy(-vViewPosition);
      vec3 ribCrossX = cross(ribDy, normal), ribCrossY = cross(normal, ribDx);
      float ribDeterminant = dot(ribDx, ribCrossX);
      vec3 ribGradient = sign(ribDeterminant)
        * (ribCrossX * dFdx(ribPhase) + ribCrossY * dFdy(ribPhase));
      float ribLength = length(ribGradient);
      if (ribLength > 0.0000001) {
        float ribSlope = 0.45 * sin(6.28318530718 * ribPhase) * ribResolved * ribMask;
        normal = normalize(normal - ribGradient / ribLength * ribSlope);
      }
    `)},e.customProgramCacheKey=()=>"filtered-spine-relief-v1"}function Bp(e,n,t){const i=t&&Ws(t)?t:void 0,r=n?Ba(n):null;if(!i&&!r)return;const a=e.onBeforeCompile,o=e.customProgramCacheKey();e.onBeforeCompile=(s,c)=>{a.call(e,s,c),i?(s.uniforms.packagingPhotoRows={value:Array.from({length:17},(d,g)=>new xt(...i[Math.min(g,i.length-1)]))},s.uniforms.packagingPhotoRowCount={value:i.length},s.fragmentShader=`
        uniform vec4 packagingPhotoRows[17];
        uniform int packagingPhotoRowCount;
        vec2 projectedPackagingUv(vec2 uv) {
          float rowPosition = clamp(uv.y, 0.0, 1.0) * float(packagingPhotoRowCount - 1);
          int row = min(packagingPhotoRowCount - 2, int(floor(rowPosition)));
          vec4 top = packagingPhotoRows[row], bottom = packagingPhotoRows[row + 1];
          return mix(mix(top.xy, top.zw, uv.x), mix(bottom.xy, bottom.zw, uv.x), rowPosition - float(row));
        }
      `+s.fragmentShader):(s.uniforms.packagingPhotoProjection={value:new Oe().set(...r)},s.fragmentShader=`
        uniform mat3 packagingPhotoProjection;
        vec2 projectedPackagingUv(vec2 uv) {
          vec3 point = packagingPhotoProjection * vec3(uv, 1.0);
          return point.xy / point.z;
        }
      `+s.fragmentShader),s.fragmentShader=s.fragmentShader.replace("#include <map_fragment>",Le.map_fragment.replace(/vMapUv/g,"projectedPackagingUv(vMapUv)"))},e.customProgramCacheKey=()=>(i?"packaging-photo-rows-v1/":"packaging-photo-projection-v1/")+o}function Gp(e){for(const n of e.children)n.userData.pocketLip?n.position.y=.00183:n.userData.pocketWall?(n.scale.y*=1.68/n.userData.wallHeight,n.position.y=99e-5):n.name.startsWith("Inner_sleeve")?n.position.y=18e-5:typeof n.userData.discSlot=="number"&&n.traverse(t=>{t instanceof et&&(t.position.y-=9e-4)})}function Hp(e,n,t,i=[]){const r=e.userData,a=r.foldLengthMm*.001,o=r.foldDirection,s=r.foldBendSide,c=r.foldFlat,d=r.foldHeightMm*.001,g=new me,_=v=>{if(i.length<3)return 0;const R=Math.max(0,Math.min(1,v))*(i.length-1),E=Math.min(i.length-2,Math.floor(R));return(i[E]*(1-R+E)+i[E+1]*(R-E))*.001},p=[];return e.traverse(v=>{if(!(v instanceof et))return;const R=v.geometry,E=R.attributes.position,u=Float32Array.from(E.array),f=R.morphAttributes.position??[],b=Array.from({length:E.count},(m,T)=>Math.max(0,Math.min(1,u[T*3]/(o*a)))),D=(m,T)=>{const U=new Float32Array(u.length),N=T===null?0:Math.PI-(c?Math.PI:Math.PI*168/180)*T/8;for(let B=0;B<E.count;B++){const V=b[B],I=N*V,X=o*(c?a*V*Math.cos(N/2):N?a/N*Math.sin(I):a*V),Z=s*(c?a*V*Math.sin(N/2):N?a/N*(1-Math.cos(I)):0),Y=c&&V>0&&V<1?N/2:I,te=_(.5-u[B*3+2]/d)*Math.sin(Math.PI*V)**2;U[B*3]=m[B*3]+X*(t-1)-s*o*Math.sin(Y)*te,U[B*3+1]=m[B*3+1]+Z*(t-1)+Math.cos(Y)*te,U[B*3+2]=m[B*3+2]}return U},S=D(u,null),A=f.map((m,T)=>{const U=Array.from({length:u.length},(B,V)=>R.morphTargetsRelative?u[V]+m.array[V]:m.array[V]),N=D(U,T);return Float32Array.from(N,(B,V)=>B-S[V])}),M=new nn(new Float32Array(u.length),3).setUsage(Ga);R.setAttribute("position",M),delete R.morphAttributes.position,delete R.morphAttributes.normal;const C=Array.isArray(v.material)?v.material:[v.material];for(const m of C)"flatShading"in m&&(m.flatShading=!0);p.push(()=>{var m;for(let T=0;T<M.array.length;T++){let U=S[T];for(let N=0;N<A.length;N++)U+=A[N][T]*(((m=v.morphTargetInfluences)==null?void 0:m[N])??0);M.array[T]=U}for(let T=0;T<E.count;T++)(b[T]<1e-6||b[T]>1-1e-6)&&(g.set(0,u[T*3+1],0),b[T]>.5&&g.applyQuaternion(n.quaternion).add(n.position),M.setXYZ(T,g.x,g.y,u[T*3+2]));M.needsUpdate=!0,R.computeBoundingBox(),R.computeBoundingSphere()})}),()=>{for(const v of p)v()}}function Vp(e,n,t){e.traverse(i=>{for(let s=i;s&&s!==e;s=s.parent)if(typeof s.userData.discSlot=="number")return;if(i.userData.foldJoint||(i.position.x*=n,i.position.z*=t),i.userData.foldSheet&&(i.userData.foldHeightMm*=t),!(i instanceof et))return;let r=i;for(;r&&!r.userData.foldSheet;)r=r.parent;const a=i.geometry,o=s=>{for(let c=0;c<s.count;c++)s.setXYZ(c,s.getX(c)*(r?1:n),s.getY(c),s.getZ(c)*t);s.needsUpdate=!0};o(a.attributes.position);for(const s of a.morphAttributes.position??[])o(s);a.computeVertexNormals(),a.computeBoundingBox(),a.computeBoundingSphere()})}function kp(e,n,t,i){const r=e.onBeforeCompile,a=e.customProgramCacheKey();e.onBeforeCompile=(o,s)=>{r.call(e,o,s),o.uniforms.paperDimensionsMm={value:new mt(...n)},o.uniforms.paperSamplingScale={value:i},o.uniforms.paperGrainStrength={value:t==="uncoated"?.018:t==="matte"?.01:.004},o.vertexShader=`varying vec2 vPaperUv;
`+o.vertexShader,o.vertexShader=o.vertexShader.replace("#include <uv_vertex>",`#include <uv_vertex>
vPaperUv = uv;`),o.fragmentShader=`
      varying vec2 vPaperUv;
      uniform vec2 paperDimensionsMm;
      uniform float paperSamplingScale;
      uniform float paperGrainStrength;
    `+o.fragmentShader,o.fragmentShader=o.fragmentShader.replace("#include <roughnessmap_fragment>",`
      #include <roughnessmap_fragment>
      vec2 paperPhase = vPaperUv * paperDimensionsMm * vec2(3.7, 5.1);
      vec2 paperFootprint = fwidth(paperPhase) * paperSamplingScale;
      float paperResolved = 1.0 - smoothstep(0.15, 0.45, max(paperFootprint.x, paperFootprint.y));
      float paperField = sin(6.2831853 * paperPhase.x) * sin(6.2831853 * paperPhase.y + 0.73);
      roughnessFactor = clamp(roughnessFactor + paperField * paperGrainStrength * paperResolved, 0.02, 1.0);
    `),o.fragmentShader=o.fragmentShader.replace("#include <normal_fragment_maps>",`
      #include <normal_fragment_maps>
      vec3 paperDx = dFdx(-vViewPosition), paperDy = dFdy(-vViewPosition);
      vec3 paperCrossX = cross(paperDy, normal), paperCrossY = cross(normal, paperDx);
      float paperSign = sign(dot(paperDx, paperCrossX));
      vec3 paperU = paperSign * (paperCrossX * dFdx(paperPhase.x) + paperCrossY * dFdy(paperPhase.x));
      vec3 paperV = paperSign * (paperCrossX * dFdx(paperPhase.y) + paperCrossY * dFdy(paperPhase.y));
      vec2 paperSlope = vec2(cos(6.2831853 * paperPhase.x) * sin(6.2831853 * paperPhase.y + 0.73),
        sin(6.2831853 * paperPhase.x) * cos(6.2831853 * paperPhase.y + 0.73));
      normal = normalize(normal - (paperU / max(length(paperU), 0.0000001) * paperSlope.x
        + paperV / max(length(paperV), 0.0000001) * paperSlope.y) * paperGrainStrength * paperResolved);
    `)},e.customProgramCacheKey=()=>"filtered-paper-grain-v1/"+a}class Wp{constructor(n,t){Re(this,"mouth");Re(this,"lip");Re(this,"position");Re(this,"quaternion");Re(this,"closed");Re(this,"walls",[]);Re(this,"angle",0);this.mouth=t,this.lip=n.children.find(a=>a.userData.pocketLip),this.position=this.lip.position.clone(),this.quaternion=this.lip.quaternion.clone(),n.updateWorldMatrix(!0,!0);const i=new Et().copy(n.matrixWorld).invert(),r=new an;this.lip.traverse(a=>{a instanceof et&&(a.geometry.computeBoundingBox(),r.union(a.geometry.boundingBox.clone().applyMatrix4(new Et().multiplyMatrices(i,a.matrixWorld))))}),this.closed=t>0?r.min.x:r.max.x;for(const a of n.children){if(!(a instanceof et)||!a.userData.pocketWall)continue;const o=a.geometry.clone(),s=o.attributes.position;a.geometry=o,s.setUsage(Ga),o.computeBoundingBox();const c=new Et().multiplyMatrices(i,a.matrixWorld);this.walls.push({geometry:o,basis:Float32Array.from(s.array),toPocket:c,fromPocket:c.clone().invert(),min:o.boundingBox.min.y,height:o.boundingBox.max.y-o.boundingBox.min.y})}}paint(n){const t=Math.max(0,Math.min(1,n/.12)),i=Math.PI/90*t*t*(3-2*t);if(i===this.angle)return i;this.angle=i;const r=Math.cos(i),a=Math.sin(i);this.lip.position.copy(this.position),this.lip.position.x=this.closed+(this.position.x-this.closed)*r,this.lip.position.y+=this.mouth*(this.position.x-this.closed)*a,this.lip.quaternion.copy(this.quaternion).premultiply(new tn().setFromAxisAngle(new me(0,0,1),this.mouth*i));const o=new me;for(const{geometry:s,basis:c,toPocket:d,fromPocket:g,min:_,height:p}of this.walls){const v=s.attributes.position;for(let R=0;R<v.count;R++){o.fromArray(c,R*3);const E=Math.max(0,Math.min(1,(o.y-_)/p));o.applyMatrix4(d);const u=o.x-this.closed;o.x+=u*(r-1)*E,o.y+=this.mouth*u*a*E,o.applyMatrix4(g),v.setXYZ(R,o.x,o.y,o.z)}v.needsUpdate=!0,s.computeVertexNormals(),s.computeBoundingBox(),s.computeBoundingSphere()}return this.lip.updateWorldMatrix(!0,!0),i}dispose(){for(const n of this.walls)n.geometry.dispose()}}const Ht=e=>{const n=Math.max(0,Math.min(1,e));return n*n*(3-2*n)};function zp(e,n){const t=Ht(e/.52);return{slide:n?t:0,lift:n?.018*Ht((e-.52)/.16):.025*t,inspect:Ht((e-(n?.68:.52))/(n?.32:.48))}}class Xp{constructor(n,t,i,r=!1,a=!1){Re(this,"discs",[]);Re(this,"owners",new Map);Re(this,"mouths",new Map);Re(this,"point",new me);Re(this,"rotation",new tn);Re(this,"scale",new me);Re(this,"matrix",new Et);Re(this,"desired",new Et);n.updateMatrixWorld(!0);const o=[];n.traverse(s=>{typeof s.userData.discSlot=="number"&&i(s)&&t(s)>=0&&o.push(s)});for(const s of o){const c=s.parent,d=c.worldToLocal(new an().setFromObject(s).getCenter(new me)),g=new rn;g.name="Inspectable_CD_"+(t(s)+1),g.quaternion.copy(s.quaternion),g.scale.copy(s.scale);const _=c.children.filter(b=>b.name.startsWith("Disc_translucent_hub")&&c.worldToLocal(new an().setFromObject(b).getCenter(new me)).distanceTo(d)<.003);g.position.copy(d),c.add(g),c.updateMatrixWorld(!0),g.attach(s);for(const b of _)g.attach(b);let p=c;for(;p&&!p.userData.holder&&!p.userData.sleeveFront;)p=p.parent;const v=(p==null?void 0:p.userData.holder)==="pocket"||r,R=(p==null?void 0:p.userData.mouthSide)??1,E=new an().setFromObject(c).getSize(new me).x,u=t(s);let f;a&&(p!=null&&p.children.some(b=>b.userData.pocketLip))&&(f=this.mouths.get(p),f||(f=new Wp(p,R),this.mouths.set(p,f))),g.traverse(b=>this.owners.set(b,u)),this.discs.push({index:u,object:g,parent:c,position:d,pocket:v,mouth:R,paperMouth:f,quaternion:g.quaternion.clone(),scale:g.scale.clone(),normal:new me(0,1,0).applyQuaternion(g.quaternion),distance:Math.max(.13,E/2+.071-R*d.x)})}}get indices(){return this.discs.map(n=>n.index).sort((n,t)=>n-t)}owner(n){return this.owners.get(n)}gripAt(n,t,i,r,a,o=22,s=-1){let c,d=o*o;const g=i.getWorldPosition(new me);for(const _ of this.discs){if(!_.pocket)continue;const p=_.parent.localToWorld(new me(_.position.x+_.mouth*.055,_.position.y,_.position.z));if(new me(0,1,0).transformDirection(_.parent.matrixWorld).dot(g.clone().sub(p).normalize())<.15)continue;const R=p.project(i);if(R.z<-1||R.z>1)continue;const E=((R.x+1)*r/2-n)**2+((1-R.y)*a/2-t)**2;if(_.index===s&&E<=(o+8)**2)return _.index;E<=d&&(c=_.index,d=E)}return c}reset(n){var i;for(const r of this.discs)r.object.position.copy(r.position),r.object.quaternion.copy(r.quaternion),r.object.scale.copy(r.scale);const t=n&&((i=this.discs.find(r=>r.index===n.index))==null?void 0:i.paperMouth);for(const r of this.mouths.values())r.paint(r===t?n.out:0)}dispose(){for(const n of this.mouths.values())n.dispose();this.mouths.clear()}paint(n,t,i,r){var S;const a=r&&this.discs.find(A=>A.index===r.index),o=r?Math.max(0,Math.min(1,r.amount)):0;if(a&&o>0&&(n.index!==a.index||n.out<=0)&&(a.object.position.copy(a.position),a.pocket?a.object.position.x+=a.mouth*.008*o:a.object.position.addScaledVector(a.normal,.0024*o),a.object.updateMatrixWorld(!0)),n.index<0||n.out<=0)return;const s=this.discs.find(A=>A.index===n.index);if(!s)return;const c=zp(n.out,s.pocket);s.parent.updateWorldMatrix(!0,!1);const d=a===s?o*(1-Ht(n.out/.52)):0,g=((S=s.paperMouth)==null?void 0:S.paint(n.out))??0;this.point.copy(s.position);const _=s.distance*c.slide+(s.pocket?.008*d:0);this.point.x+=s.mouth*(_*Math.cos(g)+.06*(Math.cos(g)-1)),this.point.y+=(_+.06)*Math.sin(g),s.pocket||this.point.addScaledVector(s.normal,c.lift+.0024*d),this.point.applyMatrix4(s.parent.matrixWorld),s.parent.getWorldQuaternion(this.rotation),this.rotation.multiply(new tn().setFromAxisAngle(new me(0,0,1),s.mouth*g)).multiply(s.quaternion),s.object.getWorldScale(this.scale);const p=i?i.slope*Math.min(1,i.aspect)*.84:0,v=.06*Math.max(this.scale.x,this.scale.z);let R=i?Math.min(1.08,t*.85*p/v):1.08;const E=s.pocket?i==null?void 0:i.bounds:void 0;E&&(R=Math.min(R,Math.max(.05,(t-E.max.z-.004)*p/(v*(1+p)))));let u=i?t-v*R/p:t*.15;E&&(u=Math.max(u,E.max.z+v*R+.004));let f=!1;if(s.pocket){const A=s.normal.clone().applyMatrix3(new Oe().setFromMatrix4(s.parent.matrixWorld));let M=c.lift;if(E&&!s.paperMouth){const C=A.clone().normalize(),m=v*Math.max(1,R)+.003;let T=1/0,U=1;for(const N of[1,-1])for(const B of["x","y"])if(Math.abs(C[B])>1e-6){const V=C[B]*N,I=V>0?E.max[B]+m:E.min[B]-m,X=Math.max(0,(I-this.point[B])/V);X<T&&(T=X,U=N)}Number.isFinite(T)&&(M*=U*Math.max(1,T/(.018*A.length())))}if(this.point.addScaledVector(A,M),E&&s.paperMouth&&A.z<=.15){let C=1/0;const m=new me;for(const T of[new me(s.mouth,0,0),new me(0,0,1),new me(0,0,-1)]){const U=T.transformDirection(s.parent.matrixWorld);for(const N of["x","y"]){const B=U[N];if(Math.abs(B)<1e-6)continue;const V=v*Math.max(1,R)+.003,I=B>0?E.max[N]+V:E.min[N]-V,X=Math.max(0,(I-this.point[N])/B);X<C&&(C=X,m.copy(U))}}Number.isFinite(C)&&(this.point.addScaledVector(m,C*Ht(c.inspect/.25)),f=!0)}}const b=E?Ht((c.inspect-(f?.5:.4))/(f?.3:.4)):c.inspect;if(E){const A=E.max.z+v*Math.max(1,R)+.004;this.point.z+=(A-this.point.z)*Ht(f?(c.inspect-.25)/.25:c.inspect/.4),this.point.x*=1-b,this.point.y*=1-b,this.point.z+=(u-this.point.z)*Ht((c.inspect-.8)/.2)}else this.point.lerp(new me(0,0,u),c.inspect);const D=new tn().setFromEuler(new zs(_n.degToRad(-n.x),_n.degToRad(n.y),0)).multiply(new tn().setFromAxisAngle(new me(1,0,0),Math.PI/2));this.rotation.slerp(D,b),this.scale.multiplyScalar(1+b*(R-1)),this.desired.compose(this.point,this.rotation,this.scale),this.matrix.copy(s.parent.matrixWorld).invert().multiply(this.desired).decompose(s.object.position,s.object.quaternion,s.object.scale),s.object.updateMatrixWorld(!0)}}function Kp(){const e=document.createElement("canvas");e.width=e.height=128;const n=e.getContext("2d"),t=n.createImageData(128,128);for(let r=0;r<128;r++)for(let a=0;a<128;a++){const o=a-63.5,s=r-63.5,c=Math.max(.01,Math.hypot(o,s)),d=(r*128+a)*4;t.data[d]=Math.round((o/c*.5+.5)*255),t.data[d+1]=Math.round((s/c*.5+.5)*255),t.data[d+2]=t.data[d+3]=255}n.putImageData(t,0,0);const i=new zn(e);return i.flipY=!1,i}function qp(e){e.onBeforeCompile=n=>{n.fragmentShader=n.fragmentShader.replace("#include <opaque_fragment>",`
      vec2 cdUv = vAnisotropyMapUv - vec2(0.5);
      float cdRadius = length(cdUv);
      vec2 cdRadial = cdUv / max(cdRadius, 0.001);
      vec3 cdView = normalize(vViewPosition);
      vec2 cdLight = normalize(vec2(0.42, 0.65) + cdView.xy * 1.4);
      float cdOrder = dot(cdRadial, cdLight);
      float cdBand = pow(abs(cdOrder), 16.0);
      float cdData = smoothstep(0.19, 0.23, cdRadius) * (1.0 - smoothstep(0.48, 0.50, cdRadius));
      float cdPhase = cdRadius * 1.7 + cdView.x * 0.9 + cdOrder * 0.18;
      vec3 cdSpectrum = vec3(0.65) + vec3(0.55) * cos(6.2831853 * (cdPhase + vec3(0.0, 0.333, 0.667)));
      outgoingLight *= mix(vec3(1.0), cdSpectrum, cdBand * cdData * 0.8);
      #include <opaque_fragment>
    `)},e.customProgramCacheKey=()=>"cd-data-ring-v1"}class $p{constructor(n,t,i,r){Re(this,"stage");Re(this,"record");Re(this,"model");Re(this,"renderer");Re(this,"world",new Oa);Re(this,"camera",new mn(36,1,.002,5));Re(this,"spin",new rn);Re(this,"conversion",new rn);Re(this,"environmentMap");Re(this,"abort",new AbortController);Re(this,"geometries",new Set);Re(this,"materials",new Set);Re(this,"textures",new Set);Re(this,"photoBitmaps",new Map);Re(this,"decodedPhotos",new Set);Re(this,"assets",[]);Re(this,"mixers",[]);Re(this,"folds",[]);Re(this,"visibleMeshes",[]);Re(this,"calibratedFolds",[]);Re(this,"box",new an);Re(this,"center",new me);Re(this,"size",new me);Re(this,"mouse",new mt);Re(this,"ray",new Xs);Re(this,"observer");Re(this,"slip",null);Re(this,"discs",null);Re(this,"discDirections",null);Re(this,"accessoryMeshes",[]);Re(this,"selectedAccessory",null);Re(this,"accessoryAnimation",0);Re(this,"disposed",!1);Re(this,"ready",!1);Re(this,"pose",{x:-8,y:-16,open:0,zoom:1,disc:{index:-1,out:0,x:0,y:0},hint:{index:-1,amount:0}});Re(this,"slipWidth",.15);Re(this,"slipHeight",.15);this.stage=n,this.record=i,this.model=r,this.renderer=new ep({canvas:t,antialias:!0,alpha:!0}),this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2)),this.renderer.outputColorSpace=Pt,this.renderer.toneMapping=Ui,this.renderer.toneMappingExposure=.9;const a=new Fp,o=new Ai(this.renderer);this.environmentMap=o.fromScene(a,.025),a.dispose(),o.dispose(),this.world.environment=this.environmentMap.texture,this.world.environmentIntensity=.5,this.world.add(this.spin),this.conversion.rotation.x=Math.PI/2,this.spin.add(this.conversion);const s=new Ia(16777215,.35);s.position.set(-.3,.5,.5),this.world.add(s,new Ks(16777215,.12)),this.observer=new ResizeObserver(()=>this.resize()),this.observer.observe(n),this.resize()}async load(){var a;const n=await this.loadAsset(Nr(this.model,!!this.record.modelCalibration,this.record.modelAssets));if(this.disposed)return;this.conversion.add(n);const t=n.children.find(o=>Array.isArray(o.userData.nominal_mm)),i=(t==null?void 0:t.userData.nominal_mm)??[135,135,2],r=(a=this.record.packaging)==null?void 0:a.size;if(r&&(Fr(this.record)?Vp(n,r.width/i[0],r.height/i[1]):this.conversion.scale.set(r.width/i[0],r.depth/i[2],r.height/i[1])),this.configure(n),this.model.slipcase){const o=await this.loadAsset(this.record.modelAssets.baseUrl.replace(/\/?$/,"/")+"slipcase.glb");if(this.disposed)return;this.configure(o,!0),this.slip=new rn,this.slip.scale.set((i[0]+2)/150,(i[2]+1.8)/30,(i[1]+2)/150),this.slip.add(o),this.conversion.add(this.slip),this.slipWidth=(i[0]+5)*.001,this.slipHeight=(i[1]+4)*.001}await this.applyTextures(),!this.disposed&&(await this.buildAccessories(),!this.disposed&&(this.discs=new Xp(n,o=>this.discIndex(o),o=>this.isVisible(o),this.model.kind==="card-sleeve",this.model.kind==="gatefold"&&this.model.panels===2&&this.model.holder==="pocket"&&this.model.pocketOpening==="inner"),this.conversion.traverse(o=>{o instanceof et&&this.isVisible(o)&&this.visibleMeshes.push(o)}),this.ready=!0,this.stage.dataset.accessoryCount=String(this.accessoryMeshes.length),this.stage.dataset.modelAsset=Nr(this.model,!!this.record.modelCalibration,this.record.modelAssets),this.stage.dataset.renderer="webgl",this.stage.dataset.ready="true",this.paint(this.pose)))}async loadAsset(n){const t=await fetch(n,{signal:this.abort.signal});if(!t.ok)throw new Error("Packaging model unavailable");const i=await new np().parseAsync(await t.arrayBuffer(),new URL(".",new URL(n,document.baseURI)).href);if(this.assets.push(i.scene),i.scene.traverse(r=>{if(r instanceof et){this.geometries.add(r.geometry);for(const a of Array.isArray(r.material)?r.material:[r.material])this.materials.add(a)}}),this.disposed)throw this.releaseAssets(),new Error("Viewer closed");if(i.animations.length){const r=new qs(i.scene),a=i.animations.map(o=>{const s=r.clipAction(o);return s.setLoop(Ys,1),s.clampWhenFinished=!0,s.play(),s.paused=!0,s});this.mixers.push({mixer:r,actions:a})}return i.scene}isVisible(n){for(let t=n;t;t=t.parent)if(!t.visible)return!1;return!0}configure(n,t=!1){var a,o;const i=Fr(this.record),r=[];n.traverse(s=>{var v;const c=s.userData,d=Math.max(0,bn(this.model,c.panel??((v=s.parent)==null?void 0:v.userData.panel)??1).length-1)*.00125;if(c.pocketLip&&(s.position.y+=d),c.pocketWall&&(s.scale.y*=1+d/((c.wallHeight??2.5)*.001),s.position.y+=d/2),c.sleeveFront&&(s.position.y+=d),c.sleeveWall&&(s.scale.y*=1+d/.0032,s.position.y+=d/2),c.foldSheet||c.foldJoint){const R=b=>{const D=bn(this.model,b).length;return D?this.model.holder==="pocket"?(this.model.kind==="gatefold"&&this.model.pocketOpening==="inner"?2.07:3.8)+(D-1)*1.25:4.8+(D-1)*1.8:0},E=c.foldIndex===0?Array.from({length:this.model.panels},(b,D)=>R(D)).reduce((b,D)=>b+D,this.model.kind==="gatefold"&&this.model.pocketOpening==="inner"?.12:.7):R(c.foldIndex+1)+R(1)+.7,u=i&&c.foldIndex===0,f=u?i.factor:Math.max(1,E/c.foldGap);c.foldSheet?u?r.push(s):(s.scale.x*=f,s.scale.y*=f):this.folds.push({object:s,factor:f,position:s.position.clone()})}if(c.holder){const R=this.model.kind==="jewel"?"tray":this.model.holder;s.visible=c.holder===R&&bn(this.model,c.panel).length>0,s.visible&&c.holder==="pocket"&&(i!=null&&i.compactPockets)&&Gp(s)}if(c.extraDisc&&(s.visible=bn(this.model,c.panel).length>1),typeof c.discSlot=="number"&&(s.visible=this.discIndex(s)>=0),!(s instanceof et))return;const g=new an().setFromBufferAttribute(s.geometry.attributes.position).getSize(new me),p=(Array.isArray(s.material)?s.material:[s.material]).map(R=>{var b,D;const E=R;let u=E.clone();const f=(b=/^Print_([^\.]+)/.exec(E.name))==null?void 0:b[1];if(f){let S=f;if(S==="disc"){let M=s;for(;M&&typeof M.userData.discSlot!="number";)M=M.parent;const C=M?Math.max(0,this.discIndex(M)):0;S=C===0?"disc":"disc"+(C+1)}const A=(S==="spine"&&!((D=s.morphTargetInfluences)!=null&&D.length)?g.y:g.x)/Math.max(1e-5,g.z);u.userData={role:S,outside:t,ratio:A},u.roughness=S.startsWith("disc")?.42:this.model.finish==="uncoated"?.86:this.model.finish==="gloss"?.24:.66}if(/Tray_Graphite/.test(E.name)&&this.model.tray!=="black"&&(u=new Rt({name:E.name,color:this.model.tray==="white"?14211282:16054780,roughness:this.model.tray==="white"?.42:.12,transmission:this.model.tray==="clear"?.94:0,ior:1.59})),/Disc_Aluminium/.test(E.name)){this.discDirections||(this.discDirections=Kp(),this.textures.add(this.discDirections));const S=new Rt({name:E.name,color:E.color,roughness:.12,metalness:1,anisotropy:.85,anisotropyMap:this.discDirections,iridescence:.45,iridescenceIOR:1.35,envMapIntensity:1.3});qp(S),u=S}if(/Tray_Graphite_Ribbed/.test(E.name)){let S=s;for(;S&&!S.userData.ribbedSpine;)S=S.parent;S&&Op(u,S.userData,this.renderer.getPixelRatio())}if(i&&(/^Paper_/.test(E.name)||f&&!f.startsWith("disc"))){let S=s;for(;S&&!S.userData.foldSheet;)S=S.parent;kp(u,[S!=null&&S.userData.foldLengthMm?S.userData.foldLengthMm*(S.userData.foldIndex===0?i.factor:1):g.x*1e3,(S==null?void 0:S.userData.foldHeightMm)??g.z*1e3],this.model.finish,this.renderer.getPixelRatio())}return this.materials.add(u),u});s.material=Array.isArray(s.material)?p:p[0]});for(const s of r){const c=(a=s.parent)==null?void 0:a.children.find(d=>d.userData.foldJoint&&d.userData.foldIndex===s.userData.foldIndex);c&&this.calibratedFolds.push(Hp(s,c,i.factor,(o=this.record.modelCalibration)==null?void 0:o.spine.reliefMm))}i&&!t&&(this.stage.dataset.spineCalibration=i.status,this.stage.dataset.spineRequestedMm=i.requestedMm.toFixed(3),this.stage.dataset.spineAppliedMm=i.appliedMm.toFixed(3),this.stage.dataset.spineBasis=i.basis)}async photoBitmap(n){return this.photoBitmaps.has(n)||this.photoBitmaps.set(n,(async()=>{const t=await fetch(n,{signal:this.abort.signal});if(!t.ok)throw new Error("Supplement image unavailable");const i=await createImageBitmap(await t.blob());if(this.disposed)throw i.close(),new Error("Viewer closed");return this.decodedPhotos.add(i),i})()),this.photoBitmaps.get(n)}async buildAccessories(){for(const n of Zs(this.record)){if(this.disposed)return;let t=null;try{const r=await this.photoBitmap(n.source);if(this.disposed)return;const a=document.createElement("canvas");a.width=r.width,a.height=r.height,a.getContext("2d").drawImage(r,0,0);const o=new zn(a);o.colorSpace=Pt,o.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy()),t=o,this.textures.add(o)}catch{if(this.disposed)return}const i=$s(n,t);this.geometries.add(i.geometries[0]),this.geometries.add(i.geometries[1]);for(const r of i.materials)this.materials.add(r);this.conversion.add(i.placement.group),this.accessoryMeshes.push(i.placement)}}setAccessory(n){if(n&&!this.accessoryMeshes.some(i=>i.id===n)||this.selectedAccessory===n)return;this.selectedAccessory=n,this.stage.dataset.accessory=n??"",cancelAnimationFrame(this.accessoryAnimation);const t=()=>{if(this.disposed)return;let i=!1;for(const r of this.accessoryMeshes){const a=r.id===this.selectedAccessory?r.extract:r.home;r.group.position.lerp(a,.22),r.group.position.distanceToSquared(a)>1e-8?i=!0:r.group.position.copy(a)}this.stage.dataset.accessoryMoving=String(i),this.paint(this.pose),i?this.accessoryAnimation=requestAnimationFrame(t):this.accessoryAnimation=0};t()}discIndex(n){let t=n.userData.discSlot;if(this.model.label.startsWith("Multi-CD")){let i=!1;for(let a=n;a;a=a.parent)a.userData.rearChamber&&(i=!0);const r=Math.ceil(this.model.discs/2);return i?(t-=2,t<this.model.discs-r?t+r:-1):t<r?t:-1}return bn(this.model,n.userData.panel??1)[t]??-1}placeholder(n,t){if(n.startsWith("disc")||n==="spine"||n==="insideSpine")return null;const i=document.createElement("canvas");i.width=i.height=512;const r=i.getContext("2d");if(!r)return null;const a=document.createElement("span");a.className="album-surface-note",a.hidden=!0,this.stage.append(a);const o=getComputedStyle(a),s=o.backgroundColor,c=o.color;a.remove(),r.fillStyle=s,r.fillRect(0,0,512,512),r.fillStyle=c,r.font="22px sans-serif",r.textAlign="center";const d=t?"贴图载入失败":n==="front"?"暂无封面":n==="back"?"示意背面":n==="outer"?"示意外套":"示意中面";r.fillText(d,256,267);const g=new zn(i);return g.flipY=!1,g.colorSpace=Pt,this.textures.add(g),g}async texture(n){var i,r,a,o;const t=Cn(this.record,n);if(!t)return this.placeholder(n,!1);try{this.photoBitmaps.has(t)||this.photoBitmaps.set(t,(async()=>{const S=await fetch(t,{signal:this.abort.signal});if(!S.ok)throw new Error("Photograph unavailable");const A=await createImageBitmap(await S.blob());if(this.disposed)throw A.close(),new Error("Viewer closed");return this.decodedPhotos.add(A),A})());const s=await this.photoBitmaps.get(t);let c=s;if(this.disposed)return null;let d=(r=(i=this.record.packaging)==null?void 0:i.photoRegions)==null?void 0:r[n],g=(a=this.record.modelWarpRows)==null?void 0:a[n];const _=n.startsWith("disc")?(o=this.record.modelDiscCalibrations)==null?void 0:o[n]:void 0,p=_&&js(_)?_:void 0,v=p?null:Qs(c.width,c.height,d,g);v&&(c=await createImageBitmap(c,v.x,v.y,v.width,v.height),d=v.region,g=v.warpRows);const R=this.stage.clientWidth<600?1024:1536,E=Math.min(1,R/Math.max(c.width,c.height));let u=document.createElement("canvas");u.width=Math.max(1,Math.round(c.width*E)),u.height=Math.max(1,Math.round(c.height*E));let f=c;for(;f.width>u.width*2||f.height>u.height*2;){const S=document.createElement("canvas");S.width=Math.max(1,Math.ceil(f.width/2)),S.height=Math.max(1,Math.ceil(f.height/2));const A=S.getContext("2d");A.imageSmoothingQuality="high",A.drawImage(f,0,0,S.width,S.height),f instanceof HTMLCanvasElement&&(f.width=f.height=1),f=S}const b=u.getContext("2d");if(b.imageSmoothingQuality="high",b.drawImage(f,0,0,u.width,u.height),f instanceof HTMLCanvasElement&&(f.width=f.height=1),c!==s&&c.close(),n.startsWith("disc"))try{const S=b.getImageData(0,0,u.width,u.height),A=p??Js(S.data,u.width,u.height),M=A&&ec(S.data,u.width,u.height,A,Math.min(1024,Math.max(u.width,u.height)));if(M){const C=document.createElement("canvas");C.width=M.width,C.height=M.height,C.getContext("2d").putImageData(new ImageData(M.data,M.width,M.height),0,0),u.width=u.height=1,u=C,d=void 0,g=void 0}}catch{}const D=new zn(u);return D.flipY=!1,D.colorSpace=Pt,D.anisotropy=Math.min(4,this.renderer.capabilities.getMaxAnisotropy()),D.userData.photoSource=!0,D.userData.photoRegion=d,D.userData.photoWarpRows=g,this.textures.add(D),D}catch{return this.disposed?null:this.placeholder(n,!0)}}async applyTextures(){var p,v,R;const n=new Set;this.conversion.traverse(E=>{if(!(!(E instanceof et)||!this.isVisible(E)))for(const u of Array.isArray(E.material)?E.material:[E.material])u instanceof Mn&&u.userData.role&&n.add(u)});const t=[...n],i=[...new Set(t.map(E=>E.userData.role))],r=new Map,a=await Promise.all(i.map(async E=>{var D,S,A;const u=Cn(this.record,E);if(!u)return[E,this.placeholder(E,!1)];const f=u+"/"+JSON.stringify([((S=(D=this.record.packaging)==null?void 0:D.photoRegions)==null?void 0:S[E])??null,((A=this.record.modelWarpRows)==null?void 0:A[E])??null]);r.has(f)||r.set(f,this.texture(E));const b=await r.get(f);return[E,b!=null&&b.userData.photoSource?b:this.disposed?null:this.placeholder(E,!0)]}));for(const E of this.decodedPhotos)E.close();if(this.decodedPhotos.clear(),this.photoBitmaps.clear(),this.disposed){this.releaseAssets();return}const o=new Map(a),s=(p=this.record.modelTextures)!=null&&p.insideSpine?"insideSpine":"spine",c=Cn(this.record,s),d=o.get(s),g=(d==null?void 0:d.userData.photoRegion)??((R=(v=this.record.packaging)==null?void 0:v.photoRegions)==null?void 0:R[s]),_=d==null?void 0:d.userData.photoWarpRows;if(this.model.kind==="gatefold"&&this.model.pocketOpening==="inner"&&!this.model.slipcase&&(g||_)&&(d!=null&&d.userData.photoSource)&&c===Cn(this.record,"insideLeft")&&c===Cn(this.record,"insideRight")){const E=g?Ba(g):null,u=d.image,f=u.getContext("2d");if((E||_)&&f){const b=[[],[],[]];for(let C=1;C<=5;C++)for(let m=1;m<=5;m++){const T=m/6,U=C/6,N=E?E[6]*T+E[7]*U+1:1,B=_?tc(_,T,U):E?[(E[0]*T+E[1]*U+E[2])/N,(E[3]*T+E[4]*U+E[5])/N]:null;if(!B)continue;const V=Math.min(u.width-1,Math.max(0,Math.round(B[0]*u.width))),I=Math.min(u.height-1,Math.max(0,Math.round(B[1]*u.height))),X=f.getImageData(V,I,1,1).data;b.forEach((Z,Y)=>Z.push(X[Y]))}const[D,S,A]=b.map(C=>C.sort((m,T)=>m-T)[12]/255),M=new Ve().setRGB(D,S,A,Pt);for(const C of this.materials)C instanceof Mn&&/^Paper_(Cut|Wrap)/.test(C.name)&&C.color.copy(M)}}for(const E of t){const u=E.userData.role,f=o.get(u);if(E.map=(f==null?void 0:f.clone())??null,E.map){const b=f.image,D=b.width/b.height,S=E.userData.ratio,A=f.userData.photoRegion,M=f.userData.photoWarpRows;(A||M)&&f.userData.photoSource?Bp(E,A,M):D>S?(E.map.repeat.x=S/D,E.map.offset.x=(1-E.map.repeat.x)/2):(E.map.repeat.y=D/S,E.map.offset.y=(1-E.map.repeat.y)/2),E.map.needsUpdate=!0,this.textures.add(E.map)}E.color.setRGB(1,1,1),E.map||E.color.setRGB(u==="insideSpine"?.72:u.startsWith("disc")?.6:.3,u==="insideSpine"?.69:u.startsWith("disc")?.63:.31,u==="insideSpine"?.61:u.startsWith("disc")?.65:.3),E.needsUpdate=!0}}paint(n){var o,s,c;if(this.pose={...n,disc:{...n.disc},hint:{...n.hint}},!this.ready||this.disposed||document.hidden)return;const t=this.model.slipcase?Math.max(0,(n.open-.45)/.55):n.open;for(const d of this.folds)d.object.position.copy(d.position);for(const{mixer:d,actions:g}of this.mixers){for(const _ of g)_.enabled=!0,_.time=_.getClip().duration*t;d.update(0)}for(const d of this.folds)d.position.copy(d.object.position),d.object.position.x*=d.factor,d.object.position.y*=d.factor;for(const d of this.calibratedFolds)d();this.slip&&(this.slip.position.x=-this.slipWidth*Math.min(1,n.open/.25),this.slip.position.z=this.slipHeight*1.05*Math.max(0,Math.min(1,(n.open-.25)/.2))),(o=this.discs)==null||o.reset(n.disc),this.spin.position.set(0,0,0),this.spin.rotation.set(_n.degToRad(-n.x),_n.degToRad(n.y),0),this.spin.updateMatrixWorld(!0),this.box.makeEmpty();for(const d of this.visibleMeshes)this.box.expandByObject(d,!!((s=d.morphTargetInfluences)!=null&&s.length));if(this.box.isEmpty())return;this.box.getCenter(this.center),this.box.getSize(this.size),this.spin.position.copy(this.center).multiplyScalar(-1),this.box.translate(this.spin.position);const i=Math.tan(_n.degToRad(this.camera.fov/2)),r=nc(n.disc.out,this.model.holder==="pocket"),a=(Math.max((this.size.x+r*2)/(i*this.camera.aspect),(this.size.y+r*2)/i)*.57+this.size.z*.5)/n.zoom;this.camera.position.set(0,0,a),this.camera.near=Math.max(.002,a*.12),this.camera.far=a+this.size.length()*2,this.camera.updateProjectionMatrix(),this.camera.lookAt(0,0,0),this.camera.updateMatrixWorld(!0),this.spin.updateMatrixWorld(!0),(c=this.discs)==null||c.paint(n.disc,a*n.zoom,{slope:i,aspect:this.camera.aspect,bounds:this.box},n.hint),this.renderer.render(this.world,this.camera),this.stage.dataset.progress=n.open.toFixed(5),this.stage.dataset.packageProgress=t.toFixed(5),this.stage.dataset.yaw=n.y.toFixed(3),this.stage.dataset.pitch=n.x.toFixed(3),this.stage.dataset.disc=n.disc.out>0?String(n.disc.index+1):"",this.stage.dataset.discProgress=n.disc.out.toFixed(5),this.stage.dataset.cameraDistance=a.toFixed(5),this.stage.dataset.cameraRoom=r.toFixed(5),this.stage.dataset.discYaw=n.disc.y.toFixed(3),this.stage.dataset.discHint=n.hint.amount>0?String(n.hint.index+1):"",this.stage.dataset.discHintProgress=n.hint.amount.toFixed(5)}get discIndices(){var n;return((n=this.discs)==null?void 0:n.indices)??[]}hoverDisc(n,t,i=-1){var r;if(!(this.pose.disc.out>.001||this.model.canOpen&&this.pose.open<1))return(r=this.pick(n,t,34,i))==null?void 0:r.disc}pick(n,t,i=22,r=-1){var d,g,_;if(!this.ready||this.disposed)return null;const a=this.stage.getBoundingClientRect();this.mouse.set((n-a.left)/a.width*2-1,1-(t-a.top)/a.height*2),this.ray.setFromCamera(this.mouse,this.camera);const o=!this.model.canOpen||this.pose.open>.9,s=o&&this.pose.disc.out<.001?(d=this.discs)==null?void 0:d.gripAt(n-a.left,t-a.top,this.camera,a.width,a.height,i,r):void 0,c=this.ray.intersectObjects(this.visibleMeshes,!1);for(const p of c){const v=(g=this.discs)==null?void 0:g.owner(p.object);if(v!==void 0&&o)return{disc:v};const R=p.object.material,E=Array.isArray(R)?R[((_=p.face)==null?void 0:_.materialIndex)??0]:R;if(!(E instanceof Rt&&E.transmission>.8))return s!==void 0?{disc:s}:{}}return s!==void 0?{disc:s}:c.length?{}:null}hits(n,t){return this.pick(n,t)!==null}resize(){const{clientWidth:n,clientHeight:t}=this.stage;!n||!t||this.disposed||(this.renderer.setSize(n,t,!1),this.camera.aspect=n/t,this.paint(this.pose))}releaseAssets(){for(const n of this.geometries)n.dispose();this.geometries.clear();for(const n of this.materials)n.dispose();this.materials.clear();for(const n of this.textures)n.dispose();this.textures.clear();for(const n of this.decodedPhotos)n.close();this.decodedPhotos.clear(),this.photoBitmaps.clear()}dispose(){var n;if(!this.disposed){this.disposed=!0,cancelAnimationFrame(this.accessoryAnimation),this.abort.abort(),this.observer.disconnect();for(const{mixer:t}of this.mixers){t.stopAllAction();for(const i of this.assets)t.uncacheRoot(i)}this.calibratedFolds.length=0,(n=this.discs)==null||n.dispose(),this.releaseAssets(),this.environmentMap.dispose(),this.world.clear(),this.renderer.dispose(),this.renderer.forceContextLoss()}}}export{$p as AlbumScene};

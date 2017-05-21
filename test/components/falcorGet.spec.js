import _ from 'lodash'
import delay from 'delay'
import EventEmitter from 'eventemitter3'

import {shallow, mount} from 'enzyme'
import {renderToStaticMarkup} from 'react-dom/server'
import falcor from 'falcor'
import React from 'react'

jest.mock('warning')

import {Provider, falcorGet} from '../../src'
import {defaultMergeProps} from '../../src/components/falcorGet'

import Foo from '../fixtures/Foo'
import model from '../fixtures/model'
import routerModel from '../fixtures/router-model'

describe('falcorGet', () => {
  describe('defaultMergeProps', () => {
    it('handle undefined response', () => {
      const props = {a: 1}
      expect(defaultMergeProps(undefined, props)).toEqual(props)
    })

    it('merge props', () => {
      const props = {a: 1, b: 2}
      expect(defaultMergeProps({json: {a: 2}}, props)).toEqual({
        a: 2,
        b: 2,
      })
    })
  })

  it('set displayName', () => {
    const Bar = falcorGet(['greeting'])(Foo)
    expect(Bar.displayName).toBe('falcorGet(Foo)')
  })

  it('accept passing single pathSet', () => {
    const Bar = falcorGet(['greeting'])(Foo)
    const FooBar = () =>
      (<Provider falcor={model}>
        <Bar />
      </Provider>)

    const wrapper = mount(<FooBar />)
    expect(wrapper.html()).toBe('<div>Hello World!</div>')
  })

  it('accept array of pathSet', () => {
    const Bar = falcorGet([['greeting']])(Foo)
    const FooBar = () =>
      (<Provider falcor={model}>
        <Bar />
      </Provider>)

    const wrapper = mount(<FooBar />)
    expect(wrapper.html()).toBe('<div>Hello World!</div>')
  })

  it('accept function that returns array of pathSet', () => {
    const Bar = falcorGet(({path}) => [[path]])(Foo)
    const FooBar = () =>
      (<Provider falcor={model}>
        <Bar path="greeting" />
      </Provider>)

    const wrapper = mount(<FooBar />)
    expect(wrapper.html()).toBe('<div>Hello World!</div>')
  })

  it('return null for undefined pathSet', () => {
    const Bar = falcorGet()(Foo)
    const FooBar = () =>
      (<Provider falcor={model}>
        <Bar />
      </Provider>)

    const wrapper = mount(<FooBar />)
    expect(wrapper.html()).toBeNull()
  })

  it('allow null pathSet to render', () => {
    const Bar = falcorGet(null)(Foo)
    const FooBar = () =>
      (<Provider falcor={model}>
        <Bar greeting="Hi!" />
      </Provider>)

    const wrapper = mount(<FooBar />)
    expect(wrapper.html()).toBe('<div>Hi!</div>')
  })

  it('can transform to props', () => {
    const Bar = falcorGet(
      ['todos[0].name', ['todos', 1, 'name']],
      ({json}) => {
        expect(json.todos[0].name).toBe('get milk from corner store')
        return {
          greeting: json.todos[1].name,
        }
      },
    )(Foo)
    const FooBar = () =>
      (<Provider falcor={model}>
        <Bar />
      </Provider>)

    const wrapper = mount(<FooBar />)
    expect(wrapper.html()).toBe('<div>withdraw money from ATM</div>')
    wrapper.unmount()
  })

  it('render nothing when mergeProps() return falsy value', () => {
    const Bar = falcorGet(['greeting'], () => null)(Foo)
    const FooBar = () =>
      (<Provider falcor={model}>
        <Bar />
      </Provider>)

    const wrapper = mount(<FooBar />)
    expect(wrapper.html()).toBeNull()
  })

  it('can handle undefined value', () => {
    const Bar = falcorGet(['undefined', 'nested', 'value'])(Foo)
    const FooBar = () =>
      (<Provider falcor={routerModel}>
        <Bar />
      </Provider>)
    const wrapper = mount(<FooBar />)
    expect(wrapper.html()).toBeNull()
  })

  it('can handle null value', () => {
    const Bar = falcorGet(['null'])(Foo)
    const FooBar = () =>
      (<Provider falcor={routerModel}>
        <Bar />
      </Provider>)
    const wrapper = mount(<FooBar />)
    expect(wrapper.html()).toBeNull()
  })

  it('re-fetch on invalidate', () => {
    const model = new falcor.Model({
      cache: {
        greeting: 'Hello World!',
      },
    })

    const Bar = falcorGet(['greeting'])(Foo)
    const FooBar = () =>
      (<Provider falcor={model}>
        <Bar />
      </Provider>)

    const wrapper = mount(<FooBar />)
    expect(wrapper.html()).toBe('<div>Hello World!</div>')

    return delay().then(() => {
      const cache = model.getCache()
      model.invalidate('greeting')
      _.set(cache, 'greeting.value', 'Hi!')
      model.setCache(cache)

      expect(wrapper.html()).toBe('<div>Hi!</div>')
    })
  })

  it('should re-render with updated props', () => {
    const model = new falcor.Model({
      cache: {
        greeting: 'Hello World!',
        greeting2: 'Hi World!',
      },
    })

    const Bar = falcorGet(
      ({path}) => [[path]],
      (res, {path}) => ({
        greeting: res.json[path],
      }),
    )(Foo)
    const FooBar = ({path}) =>
      (<Provider falcor={model}>
        <Bar path={path} />
      </Provider>)
    const wrapper = mount(<FooBar path="greeting" />)
    expect(wrapper.html()).toBe('<div>Hello World!</div>')

    wrapper.setProps({path: 'greeting2'})
    expect(wrapper.html()).toBe('<div>Hi World!</div>')
  })

  it('should resolve values for server-side rendering', () => {
    const Bar = falcorGet(['greeting'])(Foo)
    const FooBar = () =>
      (<Provider falcor={model}>
        <Bar />
      </Provider>)
    const html = renderToStaticMarkup(<FooBar />)
    expect(html).toBe('<div>Hello World!</div>')
  })

  it('should reset loading state when props change', () => {
    const model = new falcor.Model({
      cache: {
        greeting: 'Hello World!',
        greeting2: 'Hi World!',
      },
    })
    const Bar = falcorGet(
      ({path}) => [[path]],
      (res, {path}) => ({
        greeting: res.json[path],
      }),
    )(Foo)
    const setState = (Bar.prototype.setState = jest.fn(Bar.prototype.setState))
    const wrapper = shallow(<Bar path="greeting" />, {
      context: {
        falcor: {
          eventEmitter: new EventEmitter(),
          model,
        },
      },
    })
    expect(setState).toHaveBeenCalledTimes(1)
    expect(wrapper.state('loading')).toBe(false)
    expect(wrapper.find(Foo).length).toBe(1)
    expect(wrapper.find(Foo).prop('greeting')).toBe('Hello World!')

    wrapper.setProps({path: 'greeting2'})
    expect(setState).toHaveBeenCalledTimes(3)
    expect(setState.mock.calls).toEqual([
      [{loading: false, response: expect.any(Object)}],
      [{loading: true}, expect.any(Function)],
      [{loading: false, response: expect.any(Object)}],
    ])
  })

  describe('defer option', () => {
    it('should render when defer = false', () => {
      const Bar = falcorGet(['greeting'], null, {defer: false})(Foo)
      const FooBar = () =>
        (<Provider falcor={model}>
          <Bar />
        </Provider>)

      expect(shallow(<FooBar />).html()).toBe('<div>Hello World!</div>')
      expect(mount(<FooBar />).html()).toBe('<div>Hello World!</div>')
    })

    it('should shallow render nothing when defer = true', () => {
      const Bar = falcorGet(['greeting'], null, {defer: true})(Foo)
      const FooBar = () =>
        (<Provider falcor={model}>
          <Bar />
        </Provider>)

      expect(shallow(<FooBar />).html()).toBe('')
      expect(mount(<FooBar />).html()).toBe('<div>Hello World!</div>')
    })
  })

  describe('loading option', () => {
    it('can set loading component', () => {
      const Loading = () => <div>Loading</div>
      const Bar = falcorGet(['greeting'], null, {
        defer: true,
        loadingComponent: Loading,
      })(Foo)
      const FooBar = () =>
        (<Provider falcor={model}>
          <Bar />
        </Provider>)

      expect(shallow(<FooBar />).html()).toBe('<div>Loading</div>')
      expect(mount(<FooBar />).html()).toBe('<div>Hello World!</div>')
    })

    it('have no effect when defer = false', () => {
      const Loading = () => <div>Loading</div>
      const Bar = falcorGet(['greeting'], null, {
        defer: false,
        loadingComponent: Loading,
      })(Foo)
      const FooBar = () =>
        (<Provider falcor={model}>
          <Bar />
        </Provider>)

      expect(shallow(<FooBar />).html()).toBe('<div>Hello World!</div>')
      expect(mount(<FooBar />).html()).toBe('<div>Hello World!</div>')
    })
  })
})
